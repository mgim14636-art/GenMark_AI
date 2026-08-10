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

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")

# 기본값은 NVIDIA Build 공식 엔드포인트.
# 로컬 GPU에 띄운 모델을 터널(ngrok 등)로 노출해 쓰는 경우 FLUX_API_URL로 덮어쓴다.
# 터널 주소는 매번 바뀌고 외부에 노출되면 안 되므로 코드에 하드코딩하지 않는다.
DEFAULT_FLUX_API_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b"
NVIDIA_API_URL = os.environ.get("FLUX_API_URL", DEFAULT_FLUX_API_URL)

# NVIDIA API가 이 엔드포인트에 steps<=4를 강제한다(초과 시 422). 실측 확인됨.
MAX_STEPS = 4
REQUEST_TIMEOUT = 60
MAX_RETRIES = 1

_session = requests.Session()


def _call_flux_klein(prompt: str, steps: int, seed: int) -> Image.Image:
    if not NVIDIA_API_KEY:
        raise RuntimeError(
            "NVIDIA_API_KEY가 설정되지 않았습니다. .env 파일에 NVIDIA_API_KEY를 추가하세요."
        )

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    payload = {
        "prompt": prompt,
        "width": 1024,
        "height": 1024,
        "seed": seed,
        "steps": steps,
        "samples": 1,
    }

    last_error = None
    for attempt in range(MAX_RETRIES + 1):
        call_started = time.monotonic()
        try:
            response = _session.post(
                NVIDIA_API_URL, headers=headers, json=payload, timeout=REQUEST_TIMEOUT
            )
        except requests.exceptions.RequestException as e:
            last_error = RuntimeError(f"NVIDIA API 요청 실패: {e}")
            continue

        if not response.ok:
            # 429/5xx는 재시도, 4xx(잘못된 요청/필터 등)는 즉시 중단
            if response.status_code >= 500 or response.status_code == 429:
                last_error = RuntimeError(
                    f"NVIDIA API 오류 ({response.status_code}): {response.text}"
                )
                continue
            raise RuntimeError(f"NVIDIA API 오류 ({response.status_code}): {response.text}")

        artifacts = response.json().get("artifacts", [])
        if not artifacts:
            last_error = RuntimeError(f"NVIDIA API 응답에 이미지가 없습니다: {response.text}")
            continue

        artifact = artifacts[0]
        if artifact.get("finishReason") != "SUCCESS" or not artifact.get("base64"):
            raise RuntimeError(
                f"이미지 생성 실패 (finishReason={artifact.get('finishReason')}). "
                f"프롬프트가 NVIDIA 콘텐츠 필터에 걸렸을 수 있습니다. prompt={prompt!r}"
            )

        # 장당 실제 API 왕복 시간 — 시연 전 용량 산정에 쓰려고 개별로 남긴다
        print(f"[flux_service]   단일 이미지 {time.monotonic() - call_started:.1f}s (steps={steps})")

        image_bytes = base64.b64decode(artifact["base64"])
        return Image.open(BytesIO(image_bytes)).convert("RGBA")

    raise last_error or RuntimeError("NVIDIA API 요청이 알 수 없는 이유로 실패했습니다.")


def generate_logo_from_survey(survey: dict, num_variants: int = 4, steps: int = MAX_STEPS):
    """설문 기반 로고 시안을 병렬로 생성한다.

    변형(variant)마다 별도 HTTP 요청이 필요한 API라서, 순차 호출 시 총 소요 시간이
    N배로 늘어난다. ThreadPoolExecutor로 동시에 요청을 보내 벽시계 시간을 단일 요청
    수준(~1x)으로 줄인다.

    시안마다 build_prompt_from_survey(survey, variant_index=i)로 별도 프롬프트를 만들어
    같은 설문에서도 서로 다른 비주얼 모티프가 배정되게 한다 — 랜덤 시드만 다른 4장이
    아니라 실제로 형태 아이디어가 다른 4개 시안을 얻기 위함.
    """
    steps = max(1, min(steps, MAX_STEPS))
    prompts = [build_prompt_from_survey(survey, variant_index=i) for i in range(num_variants)]

    started = time.monotonic()
    results = [None] * num_variants
    errors = []

    with ThreadPoolExecutor(max_workers=num_variants) as executor:
        future_to_idx = {
            executor.submit(
                _call_flux_klein, prompts[i], steps, random.randint(0, 4294967295)
            ): i
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
