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
import re
import time
from pathlib import Path
from typing import Optional, Sequence

import requests
from dotenv import load_dotenv

from app.core.config import settings
from app.core.logging import logger

# 유사도 경로는 logo_gen_service를 import하지 않으므로 .env가 로드되지 않은 채로
# 여기까지 올 수 있다. 그 상태에서 키를 읽으면 항상 비어 있어 note가 조용히 꺼진다.
load_dotenv()

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MAX_NOTE_CHARS = 60

# 기본 모델. 이미지 입력을 받는 무료 모델 중 가장 작아 응답이 빠르다.
# note는 유사도 응답에 1~3초를 더하는 부가 기능이라 크기보다 속도가 중요하다.
# 후보 확인: python scripts/compare_llms.py --list --free --vision
DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free"


def _provider() -> str:
    """어느 API로 설명을 만들지 정한다.

    로고 생성이 OpenRouter로 통합되면서 키를 하나로 줄일 수 있게 됐다.
    다만 Gemini 경로도 남겨둔다 — 무료 등급 할당량이 서로 독립이라,
    한쪽이 429일 때 .env 한 줄로 갈아탈 수 있는 편이 시연에 유리하다.
    """
    p = os.environ.get("NOTE_PROVIDER", "").strip().lower()
    if p in ("openrouter", "gemini"):
        return p
    # 명시하지 않았으면 있는 키를 쓴다. OpenRouter를 우선한다.
    if os.environ.get("OPENROUTER_API_KEY", "").strip():
        return "openrouter"
    return "gemini"


def _api_key() -> str:
    """import 시점이 아니라 호출 시점에 읽는다.

    모듈 import 순서나 .env 로드 타이밍에 따라 값이 달라지는 것을 막는다.
    테스트에서 monkeypatch로 갈아끼우기도 쉬워진다.
    """
    if _provider() == "openrouter":
        return os.environ.get("OPENROUTER_API_KEY", "").strip()
    return os.environ.get("GEMINI_API_KEY", "").strip()


def _model() -> str:
    if _provider() == "openrouter":
        return os.environ.get("NOTE_MODEL", DEFAULT_OPENROUTER_MODEL).strip()
    return os.environ.get("GEMINI_MODEL", "gemini-flash-latest").strip()


def _timeout() -> float:
    # 점수 계산은 로컬에서 0.3초면 끝난다. 외부 호출이 그보다 훨씬 오래 걸리면
    # 설명을 포기하는 편이 낫다.
    try:
        return float(os.environ.get("NOTE_TIMEOUT_SECONDS", "8"))
    except ValueError:
        return 8.0


THUMB_SIZE = 384

PROMPT = """첫 번째 이미지는 사용자가 만든 로고이고, 나머지는 기존 등록 상표입니다.
각 등록 상표가 첫 번째 로고와 시각적으로 어떤 점이 닮았는지 설명하세요.

작성 규칙:
- 반드시 한국어로만 작성 (영어 단어 사용 금지)
- 도형의 형태·구도·배치를 중심으로 서술 (색상은 부수적)
- 각 항목 15~40자, "~해요" 로 끝나는 평서문
- 닮은 점이 뚜렷하지 않으면 "뚜렷하게 닮은 점은 없어요" 라고 쓰세요
- 침해 여부·등록 가능성 같은 법적 판단은 절대 쓰지 마세요
- 이 지시문의 내용을 그대로 옮겨 적지 마세요

등록 상표 개수만큼의 문자열 배열로 답하세요."""

# 법적 판단으로 읽힐 수 있는 표현. 하나라도 걸리면 그 note는 버린다.
BANNED = (
    "침해", "위반", "등록 가능", "등록가능", "거절", "무효", "소송", "분쟁",
    "법적", "위법", "권리", "저촉", "출원하면", "등록될",
)


# 429를 받으면 잠시 호출을 멈춘다. 무료 등급에서 남은 요청까지 태우지 않기 위함이다.
QUOTA_COOLDOWN = 60.0
_quota_blocked_until = 0.0


def _quota_blocked() -> bool:
    return time.monotonic() < _quota_blocked_until


def _block_quota() -> None:
    global _quota_blocked_until
    _quota_blocked_until = time.monotonic() + QUOTA_COOLDOWN


def is_enabled() -> bool:
    return bool(_api_key())


# 한글이 한 글자도 없으면 지시문이 영어로 새어나온 경우다.
# 실제로 "Under 40 characters per" 같은 응답이 사용자에게 노출된 적이 있다.
_HANGUL = re.compile(r"[가-힣]")


def _sanitize(text: object) -> Optional[str]:
    """법적 판단이 섞였거나 형식이 어긋난 설명은 폐기한다."""
    if not isinstance(text, str):
        return None
    note = " ".join(text.split()).strip().strip('"')
    if not note:
        return None

    # JSON 파편이 흘러든 흔적
    if note[0] in '[]{}:,"\'' or note.startswith("```"):
        logger.warning("Note dropped, looks like a fragment: %r", note[:60])
        return None

    if not _HANGUL.search(note):
        logger.warning("Note dropped, no Korean text: %r", note[:60])
        return None

    if len(note) < 5:
        return None
    if any(word in note for word in BANNED):
        # 원문을 로그에 남겨 프롬프트 튜닝에 쓴다. 사용자에게는 나가지 않는다.
        logger.warning("Note dropped by content filter: %s", note[:80])
        return None
    return note[:MAX_NOTE_CHARS]


def _encode(source) -> str:
    """이미지를 축소·흰배경 합성한 뒤 base64 JPEG 문자열로 만든다.

    투명 배경을 그대로 두면 알파가 검정으로 합성되어 실제와 다른 그림이 전달된다.
    KIPRIS 도면이 모두 흰 배경이므로 조건을 맞춘다.
    source는 파일 경로 또는 바이트열.
    """
    from PIL import Image

    opener = Image.open(io.BytesIO(source)) if isinstance(source, bytes) else Image.open(source)
    with opener as im:
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
            im = Image.alpha_composite(bg, im)
        im = im.convert("RGB")
        im.thumbnail((THUMB_SIZE, THUMB_SIZE))
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=85)

    return base64.b64encode(buf.getvalue()).decode()


def _image_part(path: Path) -> dict:
    """Gemini 형식 (inline_data)."""
    return {"inline_data": {"mime_type": "image/jpeg", "data": _encode(path)}}


def _query_part(image_bytes: bytes) -> dict:
    """Gemini 형식 (inline_data)."""
    return {"inline_data": {"mime_type": "image/jpeg", "data": _encode(image_bytes)}}


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
        # debug로 두면 왜 note가 안 나오는지 아무도 모른다. 설정 실수는 눈에 띄어야 한다.
        key_name = "OPENROUTER_API_KEY" if _provider() == "openrouter" else "GEMINI_API_KEY"
        logger.warning("%s가 없어 note를 생성하지 않습니다 (.env 확인)", key_name)
        return blank
    if _quota_blocked():
        logger.warning("할당량 초과 상태 — note 생성을 건너뜁니다")
        return blank

    root = Path(settings.trademark_data_root)
    try:
        images = [_encode(query_image)]
        for rel in image_paths:
            path = root / rel
            if not path.exists():
                logger.warning("Note skipped, image missing: %s", rel)
                return blank
            images.append(_encode(path))
    except Exception as e:
        logger.warning("Note image prep failed: %s", type(e).__name__)
        return blank

    if _provider() == "openrouter":
        text = _call_openrouter(images)
        if text is None:
            return blank
        raw = _parse_notes(text)
        if raw is None:
            logger.warning("Note parse failed. 응답 앞부분: %r", text[:200])
            return blank
        notes = [_sanitize(item) for item in raw[: len(image_paths)]]
        return notes + [None] * (len(image_paths) - len(notes))

    parts = [{"text": PROMPT}] + [
        {"inline_data": {"mime_type": "image/jpeg", "data": b64}} for b64 in images
    ]

    # 모델·API 버전에 따라 지원하지 않는 옵션이 있고, Google은 400에
    # "Request contains an invalid argument."만 주고 어떤 필드인지 알려주지 않는다.
    # 그래서 기능을 하나씩 덜어내며 재시도한다.
    configs = [
        {
            "temperature": 0.3,
            "maxOutputTokens": 800,
            "responseMimeType": "application/json",
            "responseSchema": {"type": "ARRAY", "items": {"type": "STRING"}},
            # thinking 토큰이 maxOutputTokens에서 차감돼 본문이 잘리는 것을 막는다.
            "thinkingConfig": {"thinkingBudget": 0},
        },
        {   # thinkingConfig 미지원 모델
            "temperature": 0.3,
            "maxOutputTokens": 2048,   # 추론 토큰을 못 끄면 예산을 넉넉히 준다
            "responseMimeType": "application/json",
            "responseSchema": {"type": "ARRAY", "items": {"type": "STRING"}},
        },
        {   # 구조화 출력 미지원 모델 — 파서가 코드펜스·머리말을 흡수한다
            "temperature": 0.3,
            "maxOutputTokens": 2048,
        },
    ]

    text = None
    for i, generation_config in enumerate(configs):
        if _quota_blocked():
            logger.warning("Gemini 할당량 초과 상태 — note 생성을 건너뜁니다")
            return blank

        try:
            res = requests.post(
                GEMINI_URL.format(model=_model()),
                params={"key": _api_key()},
                json={
                    "contents": [{"parts": parts}],
                    "generationConfig": generation_config,
                },
                timeout=(3.05, _timeout()),
            )
        except requests.exceptions.Timeout:
            logger.warning("Note generation timed out (%.0fs)", _timeout())
            return blank
        except Exception as e:
            logger.warning("Note request failed: %s", type(e).__name__)
            return blank

        if res.status_code == 429:
            # 무료 등급에서 흔하다. 남은 요청까지 소모하지 않도록 잠시 차단한다.
            _block_quota()
            logger.warning(
                "Gemini 할당량 초과(429). %.0f초간 note 생성을 중단합니다. %s",
                QUOTA_COOLDOWN,
                res.text[:200],
            )
            return blank

        if not res.ok:
            body = res.text[:300]
            if res.status_code == 400 and i + 1 < len(configs):
                dropped = set(generation_config) - set(configs[i + 1])
                logger.warning("400 — %s 제거 후 재시도합니다", ", ".join(sorted(dropped)) or "옵션")
                continue
            logger.warning("Note generation failed (HTTP %s): %s", res.status_code, body)
            return blank

        payload = res.json()
        candidates = payload.get("candidates") or []
        if not candidates:
            logger.warning("Note blocked or empty: %s", str(payload.get("promptFeedback"))[:200])
            return blank

        candidate = candidates[0]
        finish = candidate.get("finishReason")
        if finish and finish not in ("STOP", "FINISH_REASON_STOP"):
            usage = payload.get("usageMetadata", {})
            logger.warning(
                "Note response not finished (%s). thoughts=%s output=%s",
                finish,
                usage.get("thoughtsTokenCount"),
                usage.get("candidatesTokenCount"),
            )

        try:
            text = candidate["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError):
            logger.warning("Note response has no text part: %s", str(candidate)[:200])
            return blank
        break

    if text is None:
        return blank

    raw = _parse_notes(text)
    if raw is None:
        # 무엇을 받았는지 남기지 않으면 프롬프트를 고칠 수 없다.
        # 모델 출력이라 민감정보는 아니지만 길이는 제한한다.
        logger.warning("Note parse failed. 응답 앞부분: %r", text[:200])
        return blank

    notes = [_sanitize(item) for item in raw[: len(image_paths)]]
    notes += [None] * (len(image_paths) - len(notes))
    return notes


def _call_openrouter(images: list[str]) -> Optional[str]:
    """OpenAI 호환 채팅 API로 설명을 받아온다. 실패하면 None.

    Gemini와 달리 옵션을 단계적으로 덜어낼 필요가 없다 — 지원하지 않는 필드는
    보통 무시되고, 400을 주는 경우에도 어떤 필드인지 알려주기 때문이다.
    다만 response_format(JSON 강제)은 모델마다 지원이 갈려 400이 나므로,
    그때는 한 번만 끄고 재시도한다. 파서가 코드펜스·머리말을 흡수한다.
    """
    content = [{"type": "text", "text": PROMPT}] + [
        {"type": "image_url",
         "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
        for b64 in images
    ]
    payload = {
        "model": _model(),
        "messages": [{"role": "user", "content": content}],
        "temperature": 0.3,
        # 15~40자 설명 3건이면 충분하다. 추론형 모델이 생각을 길게 쓰다
        # 잘리는 것을 막되, 무한정 늘리지는 않는다.
        "max_tokens": 700,
        "response_format": {"type": "json_object"},
    }

    for attempt in range(2):
        try:
            res = requests.post(
                OPENROUTER_URL,
                headers={"Authorization": f"Bearer {_api_key()}",
                         "Content-Type": "application/json"},
                json=payload,
                # (연결, 읽기)로 나눠 준다. 값 하나만 주면 소켓 읽기 단위로만
                # 적용되어, 서버가 연결만 유지한 채 응답을 미루면 무한정 기다린다
                # (무료 등급 대기열에서 실제로 겪음).
                timeout=(3.05, _timeout()),
            )
        except requests.exceptions.Timeout:
            logger.warning("Note generation timed out (%.0fs)", _timeout())
            return None
        except Exception as e:
            logger.warning("Note request failed: %s", type(e).__name__)
            return None

        if res.status_code == 429:
            # 무료 등급에서 흔하다. 남은 요청까지 소모하지 않도록 잠시 차단한다.
            _block_quota()
            logger.warning(
                "OpenRouter 할당량 초과(429). %.0f초간 note 생성을 중단합니다. %s",
                QUOTA_COOLDOWN, res.text[:200],
            )
            return None

        if not res.ok:
            if res.status_code == 400 and attempt == 0 and "response_format" in payload:
                logger.warning("400 — response_format 제거 후 재시도합니다")
                payload.pop("response_format")
                continue
            logger.warning("Note generation failed (HTTP %s): %s",
                           res.status_code, res.text[:300])
            return None

        choice = ((res.json().get("choices") or [{}])[0])
        msg = choice.get("message") or {}
        text = msg.get("content") or msg.get("reasoning") or ""
        if choice.get("finish_reason") == "length":
            # 추론형 모델이 생각을 길게 쓰다 잘린 경우. 잘린 JSON을 통과시키면
            # 깨진 문구가 사용자에게 노출되므로 파서가 걸러내지만, 원인은 남긴다.
            logger.warning("Note response truncated (max_tokens). model=%s", _model())
        return text or None

    return None


def _parse_notes(text: str) -> Optional[list]:
    """LLM 응답에서 설명 배열을 최대한 건져낸다.

    "JSON 배열로만 답하라"고 지시해도 코드펜스·머리말·객체 감싸기 등이 섞여 나온다.
    형식이 조금 어긋났다고 기능 전체를 포기하는 것보다 관대하게 파싱하는 편이 낫다.
    """
    if not text:
        return None

    cleaned = re.sub(r"```(?:json)?", "", text).strip()

    # 1) 통째로 JSON인 경우
    for candidate in (cleaned,):
        try:
            parsed = json.loads(candidate)
        except Exception:
            break
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            # {"notes": [...]} 처럼 감싸서 오는 경우
            for value in parsed.values():
                if isinstance(value, list):
                    return value
        break

    # 2) 본문 어딘가에 박힌 배열만 뽑아내기
    match = re.search(r"\[.*?\]", cleaned, re.S)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass

    # 줄 단위 폴백은 두지 않는다.
    # 응답이 잘렸을 때 JSON 파편("[\"곡선 형태의...", ": 전체적인 방패...")을
    # 그대로 note로 통과시키는 사고가 있었다. 형식이 어긋나면 note를 포기하는 편이
    # 깨진 문구를 사용자에게 보여주는 것보다 낫다.
    return None
