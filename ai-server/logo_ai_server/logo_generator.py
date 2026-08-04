import base64
import os
import random
from io import BytesIO

import requests
from dotenv import load_dotenv
from PIL import Image

from prompt_builder import build_prompt_from_survey

load_dotenv()

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")
NVIDIA_API_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b"


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

    response = requests.post(NVIDIA_API_URL, headers=headers, json=payload, timeout=120)
    if not response.ok:
        raise RuntimeError(f"NVIDIA API 오류 ({response.status_code}): {response.text}")

    artifacts = response.json().get("artifacts", [])
    if not artifacts:
        raise RuntimeError(f"NVIDIA API 응답에 이미지가 없습니다: {response.text}")

    artifact = artifacts[0]
    if artifact.get("finishReason") != "SUCCESS" or not artifact.get("base64"):
        raise RuntimeError(
            f"이미지 생성 실패 (finishReason={artifact.get('finishReason')}). "
            f"프롬프트가 NVIDIA 콘텐츠 필터에 걸렸을 수 있습니다. prompt={prompt!r}"
        )

    image_bytes = base64.b64decode(artifact["base64"])
    return Image.open(BytesIO(image_bytes)).convert("RGBA")


def generate_logo_from_survey(survey: dict, num_variants: int = 4, steps: int = 4):
    prompt = build_prompt_from_survey(survey)
    images = []
    for _ in range(num_variants):
        seed = random.randint(0, 4294967295)
        images.append(_call_flux_klein(prompt, steps, seed))
    return images
