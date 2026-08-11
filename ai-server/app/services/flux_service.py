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

REQUEST_TIMEOUT = 60
MAX_RETRIES = 1

_session = requests.Session()




def _call_flux_pro(prompt: str) -> Image.Image:
    if not OPENROUTER_API_KEY:
        raise RuntimeError(
            "OPENROUTER_API_KEY가 설정되지 않았습니다. .env 파일에 OPENROUTER_API_KEY를 추가하세요."
        )

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "black-forest-labs/flux.2-pro",
        "prompt": prompt,
        "aspect_ratio": "1:1",
        "output_format": "png",
    }

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

        print(f"[flux_service]   단일 이미지 {time.monotonic() - call_started:.1f}s")

        image_bytes = base64.b64decode(data[0]["b64_json"])
        return Image.open(BytesIO(image_bytes)).convert("RGBA")

    raise last_error or RuntimeError("OpenRouter API 요청이 알 수 없는 이유로 실패했습니다.")


def generate_logo_from_survey(survey: dict, num_variants: int = 4, steps: int = 4):
    """설문 기반 로고 시안을 병렬로 생성한다. (steps는 이 모델에서 쓰이지 않지만
    기존 app.py/schemas 호출 시그니처와 맞추기 위해 인자로만 받는다.)"""
    survey = dict(survey)
    survey["_motif_jitter"] = random.randint(0, 1_000_000)
    prompts = [build_prompt_from_survey(survey, variant_index=i) for i in range(num_variants)]

    started = time.monotonic()
    results = [None] * num_variants
    errors = []

    with ThreadPoolExecutor(max_workers=num_variants) as executor:
        future_to_idx = {
            executor.submit(_call_flux_pro, prompts[i]): i
            for i in range(num_variants)
        }
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                results[idx] = future.result()
            except Exception as e:
                errors.append(str(e))

    images = [img for img in results if img is not None]
    elapsed = time.monotonic() - started
    print(f"[flux_service] {len(images)}/{num_variants} variants in {elapsed:.1f}s")

    if not images:
        raise RuntimeError(
            "로고 생성에 모두 실패했습니다: " + " | ".join(errors[:num_variants])
        )
    return images