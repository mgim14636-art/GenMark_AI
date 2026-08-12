import base64
import os
import random
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO

import requests
from dotenv import load_dotenv
from PIL import Image

from app.services.prompt_service import build_prompt_from_survey

load_dotenv()

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/images"
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "black-forest-labs/flux.2-pro")

REQUEST_TIMEOUT = 60
MAX_RETRIES = 1

_session = requests.Session()


def _call_image_api(prompt: str, seed: int | None = None) -> Image.Image:
    if not OPENROUTER_API_KEY:
        raise RuntimeError(
            "OPENROUTER_API_KEY가 설정되지 않았습니다. .env 파일에 OPENROUTER_API_KEY를 추가하세요."
        )

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "prompt": prompt,
        "aspect_ratio": "1:1",
        "output_format": "png",
    }
    # flux.2-pro 엔드포인트가 seed를 지원한다(images/models/.../endpoints에서 확인).
    # 같은 프롬프트로 재현하거나, 마음에 든 시안을 다시 뽑을 때 필요하므로 넘기고
    # 백엔드 ai_metadata_json에 저장할 수 있게 응답에도 실어 보낸다.
    if seed is not None:
        payload["seed"] = seed

    last_error = None
    for attempt in range(MAX_RETRIES + 1):
        call_started = time.monotonic()
        try:
            response = _session.post(
                OPENROUTER_API_URL, headers=headers, json=payload, timeout=REQUEST_TIMEOUT
            )
        except requests.exceptions.RequestException as e:
            last_error = RuntimeError(f"OpenRouter API 요청 실패: {e}")
            continue

        if not response.ok:
            if response.status_code >= 500 or response.status_code == 429:
                last_error = RuntimeError(
                    f"OpenRouter API 오류 ({response.status_code}): {response.text}"
                )
                continue
            raise RuntimeError(f"OpenRouter API 오류 ({response.status_code}): {response.text}")

        data = response.json().get("data", [])
        if not data or not data[0].get("b64_json"):
            last_error = RuntimeError(f"OpenRouter API 응답에 이미지가 없습니다: {response.text}")
            continue

        print(f"[logo_gen_service]   단일 이미지 {time.monotonic() - call_started:.1f}s")

        image_bytes = base64.b64decode(data[0]["b64_json"])
        return Image.open(BytesIO(image_bytes)).convert("RGBA")

    raise last_error or RuntimeError("OpenRouter API 요청이 알 수 없는 이유로 실패했습니다.")


def generate_logo_variants(
    survey: dict,
    num_variants: int = 4,
    steps: int = 4,
    variant_offset: int = 0,
):
    """설문 기반 로고 시안을 병렬로 생성하고, 시안별 생성 파라미터를 함께 반환한다.

    변형(variant)마다 별도 HTTP 요청이 필요한 API라서, 순차 호출 시 총 소요 시간이
    N배로 늘어난다. ThreadPoolExecutor로 동시에 요청을 보내 벽시계 시간을 단일 요청
    수준(~1x)으로 줄인다.

    시안마다 build_prompt_from_survey(survey, variant_index=v)로 별도 프롬프트를 만들어
    같은 설문에서도 서로 다른 비주얼 모티프가 배정되게 한다 — 랜덤 시드만 다른 4장이
    아니라 실제로 형태 아이디어가 다른 4개 시안을 얻기 위함.

    variant_offset:
        재생성(F12-2)용. prompt_service._resolve_motif가 variant_index로 모티프와
        렌더링 방식을 순환 배정하므로, 재생성 시 offset을 주면 직전 회차와 다른
        모티프가 배정된다. 1회차 0~3 → 2회차 4~7. 이전 로고 이미지를 부정 프롬프트로
        되돌려 보낼 필요가 없어 요청도 가볍다.

    steps:
        OpenRouter flux.2-pro에는 해당 파라미터가 없다. 기존 호출부 시그니처를
        유지하려고 인자로만 받고 쓰지 않는다.

    반환: [{"image": Image, "seed": int, "variant_index": int}, ...] (생성 성공분만)
    """
    del steps  # 호출부 호환용으로만 받는다

    indices = [variant_offset + i for i in range(num_variants)]
    prompts = [build_prompt_from_survey(survey, variant_index=v) for v in indices]
    seeds = [random.randint(0, 2_147_483_647) for _ in range(num_variants)]

    started = time.monotonic()
    results = [None] * num_variants
    errors = []

    with ThreadPoolExecutor(max_workers=num_variants) as executor:
        future_to_idx = {
            executor.submit(_call_image_api, prompts[i], seeds[i]): i
            for i in range(num_variants)
        }
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                results[idx] = future.result()
            except Exception as e:
                errors.append(str(e))

    variants = [
        {"image": img, "seed": seeds[i], "variant_index": indices[i]}
        for i, img in enumerate(results)
        if img is not None
    ]
    elapsed = time.monotonic() - started
    print(f"[logo_gen_service] {len(variants)}/{num_variants} variants in {elapsed:.1f}s")

    if not variants:
        raise RuntimeError(
            "로고 생성에 모두 실패했습니다: " + " | ".join(errors[:num_variants])
        )
    return variants


def generate_logo_from_survey(
    survey: dict,
    num_variants: int = 4,
    steps: int = 4,
    variant_offset: int = 0,
):
    """이미지 리스트만 필요한 호출부(스크립트 등)를 위한 얇은 래퍼."""
    return [
        v["image"]
        for v in generate_logo_variants(survey, num_variants, steps, variant_offset)
    ]
