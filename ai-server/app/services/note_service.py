"""검출된 상표가 왜 닮았는지 한 줄로 설명한다 (Gemini 멀티모달).

점수만으로는 사용자가 "그래서 뭐가 닮았다는 건데?"를 알 수 없다.
쿼리 로고와 검출 상표 이미지를 함께 넣어 형태 관점의 설명을 받는다.

설계 원칙
- note는 부가 정보다. 실패·지연·필터링 시 None을 반환하고 유사도 결과는 그대로 나간다.
  외부 API 장애가 핵심 기능(점수)을 막으면 안 된다.
- 호출은 요청당 1회. 매치 3건을 한 번에 보내 지연과 비용을 1/3로 줄인다.
- 법적 판단이 섞인 문장은 서버에서 폐기한다. 프롬프트로 금지하되 LLM 출력은
  보장되지 않으므로, 상표 서비스의 리스크를 고려해 한 겹 더 거른다.
"""
from __future__ import annotations

import base64
import io
import json
import os
from pathlib import Path
from typing import Optional, Sequence

import requests

from app.core.config import settings
from app.core.logging import logger

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# 점수 계산은 로컬에서 0.3초면 끝난다. 외부 호출이 그보다 훨씬 오래 걸리면
# 설명을 포기하는 편이 낫다.
REQUEST_TIMEOUT = float(os.environ.get("NOTE_TIMEOUT_SECONDS", "8"))
MAX_NOTE_CHARS = 60
THUMB_SIZE = 384

PROMPT = """첫 번째 이미지는 사용자가 생성한 로고이고, 나머지는 기존 등록 상표입니다.
각 등록 상표가 생성 로고와 시각적으로 어떤 점이 닮았는지 한 문장씩 설명하세요.

규칙:
- 도형의 형태·구도·배치 중심으로 설명 (색상은 부수적)
- 40자 이내, "~해요" 체
- 닮은 점이 뚜렷하지 않으면 그렇게 쓰세요
- 법적 판단(침해 여부, 등록 가능성)은 절대 언급 금지

JSON 배열로만 답하세요: ["설명1", "설명2", "설명3"]"""

# 법적 판단으로 읽힐 수 있는 표현. 하나라도 걸리면 그 note는 버린다.
BANNED = (
    "침해", "위반", "등록 가능", "등록가능", "거절", "무효", "소송", "분쟁",
    "법적", "위법", "권리", "저촉", "출원하면", "등록될",
)


def is_enabled() -> bool:
    return bool(GEMINI_API_KEY)


def _sanitize(text: object) -> Optional[str]:
    """법적 판단이 섞였거나 형식이 어긋난 설명은 폐기한다."""
    if not isinstance(text, str):
        return None
    note = " ".join(text.split()).strip().strip('"')
    if not note:
        return None
    if any(word in note for word in BANNED):
        # 원문을 로그에 남겨 프롬프트 튜닝에 쓴다. 사용자에게는 나가지 않는다.
        logger.warning("Note dropped by content filter: %s", note[:80])
        return None
    return note[:MAX_NOTE_CHARS]


def _image_part(path: Path) -> dict:
    from PIL import Image

    with Image.open(path) as im:
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
            im = Image.alpha_composite(bg, im)
        im = im.convert("RGB")
        im.thumbnail((THUMB_SIZE, THUMB_SIZE))
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=85)

    return {
        "inline_data": {
            "mime_type": "image/jpeg",
            "data": base64.b64encode(buf.getvalue()).decode(),
        }
    }


def _query_part(image_bytes: bytes) -> dict:
    from PIL import Image

    with Image.open(io.BytesIO(image_bytes)) as im:
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
            im = Image.alpha_composite(bg, im)
        im = im.convert("RGB")
        im.thumbnail((THUMB_SIZE, THUMB_SIZE))
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=85)

    return {
        "inline_data": {
            "mime_type": "image/jpeg",
            "data": base64.b64encode(buf.getvalue()).decode(),
        }
    }


def generate_notes(
    query_image: bytes, image_paths: Sequence[str]
) -> list[Optional[str]]:
    """매치 개수만큼의 설명 리스트를 반환한다. 실패한 자리는 None.

    호출자는 note가 None일 수 있음을 전제해야 한다.
    """
    blank: list[Optional[str]] = [None] * len(image_paths)
    if not image_paths:
        return blank
    if not is_enabled():
        logger.debug("GEMINI_API_KEY 미설정 — note 생략")
        return blank

    root = Path(settings.trademark_data_root)
    try:
        parts = [{"text": PROMPT}, _query_part(query_image)]
        for rel in image_paths:
            path = root / rel
            if not path.exists():
                logger.warning("Note skipped, image missing: %s", rel)
                return blank
            parts.append(_image_part(path))
    except Exception as e:
        logger.warning("Note image prep failed: %s", type(e).__name__)
        return blank

    try:
        res = requests.post(
            GEMINI_URL.format(model=GEMINI_MODEL),
            params={"key": GEMINI_API_KEY},
            json={
                "contents": [{"parts": parts}],
                "generationConfig": {"temperature": 0.3, "maxOutputTokens": 300},
            },
            timeout=REQUEST_TIMEOUT,
        )
        res.raise_for_status()
        text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
    except requests.exceptions.Timeout:
        logger.warning("Note generation timed out (%.0fs)", REQUEST_TIMEOUT)
        return blank
    except Exception as e:
        # API 키가 로그에 실리지 않도록 예외 타입만 남긴다.
        logger.warning("Note generation failed: %s", type(e).__name__)
        return blank

    try:
        cleaned = text.replace("```json", "").replace("```", "").strip()
        raw = json.loads(cleaned)
        if not isinstance(raw, list):
            raise ValueError("expected a JSON array")
    except Exception as e:
        logger.warning("Note parse failed: %s", type(e).__name__)
        return blank

    notes = [_sanitize(item) for item in raw[: len(image_paths)]]
    notes += [None] * (len(image_paths) - len(notes))
    return notes
