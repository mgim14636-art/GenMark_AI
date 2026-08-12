import base64
import re
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
# 모델 비교 실험(scripts/compare_models.py, 2026-08-12)으로 확정.
# 벡터 모델을 쓰는 이유:
#   - 색이 확산 픽셀이 아니라 fill 값이라 지정한 HEX가 오차 없이 그대로 나온다
#     (래스터는 오차 65~127, 벡터는 0 — 실측)
#   - 배경이 단일 path라 지워서 투명 배경을 정확히 만들 수 있다
#   - 확대·축소에 무손실이라 명함·간판·파비콘을 한 원본으로 커버한다
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "recraft/recraft-v4-vector")

# 시드를 받는 모델과 아닌 모델이 섞여 있다. Recraft 계열은 시드를 지원하지 않아
# 넘기면 400이 떨어진다. 슬러그로 판단해 지원하는 모델에만 싣는다.
_SEED_CAPABLE_PREFIXES = ("black-forest-labs/",)

REQUEST_TIMEOUT = 60
MAX_RETRIES = 1

_session = requests.Session()


def supports_seed(model: str | None = None) -> bool:
    return str(model or OPENROUTER_MODEL).startswith(_SEED_CAPABLE_PREFIXES)


def is_vector(model: str | None = None) -> bool:
    return str(model or OPENROUTER_MODEL).endswith("-vector")


def rasterize_svg(svg: str, size: int = 1024) -> Image.Image:
    """SVG를 PIL 이미지로 변환한다.

    logo_composer(한글 폰트 합성)와 dino_service(유사도)는 둘 다 래스터를 다룬다.
    SVG 원본은 다운로드·편집용으로 따로 보관하고, 파이프라인에는 변환본을 태운다.
    """
    import cairosvg  # 무거워서 함수 안에서 import (유사도 경로는 쓰지 않는다)

    png = cairosvg.svg2png(
        bytestring=svg.encode("utf-8"), output_width=size, output_height=size
    )
    return Image.open(BytesIO(png)).convert("RGBA")


def strip_background(svg: str) -> str:
    """SVG 맨 앞의 배경 사각형 path를 제거해 투명 배경으로 만든다.

    Recraft 벡터 응답은 캔버스 전체를 덮는 사각형 path 하나로 배경을 깐다.
    래스터였다면 floodfill로 배경색을 추적해야 했지만(brand_kit_service의 그 처리),
    벡터는 해당 path만 지우면 되므로 색 번짐이나 구멍이 생기지 않는다.

    viewBox 전체를 덮는 사각형만 지운다 — 마크 자체가 사각형인 경우를 살리기 위함.
    """
    m = re.search(r'viewBox="[\d.\s]*?([\d.]+)\s+([\d.]+)"', svg)
    if not m:
        return svg
    w, h = float(m.group(1)), float(m.group(2))

    def _covers_canvas(d: str) -> bool:
        xs = [float(v) for v in re.findall(r"[-\d.]+", d)][0::2]
        ys = [float(v) for v in re.findall(r"[-\d.]+", d)][1::2]
        if not xs or not ys:
            return False
        return (
            min(xs) <= 1 and min(ys) <= 1
            and max(xs) >= w - 1 and max(ys) >= h - 1
            and len(xs) <= 6  # 사각형 수준의 단순한 path만
        )

    def _sub(mo):
        return "" if _covers_canvas(mo.group(1)) else mo.group(0)

    return re.sub(r'<path[^>]*\sd="([^"]+)"[^>]*/>', _sub, svg, count=3)


def _call_image_api(prompt: str, seed: int | None = None):
    """반환: (PIL 이미지, SVG 문자열 또는 None)"""
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
    }
    if not is_vector():
        payload["output_format"] = "png"
    # 시드를 지원하는 모델에만 싣는다. 지원 모델에서는 같은 프롬프트를 재현하거나
    # 마음에 든 시안을 다시 뽑을 때 쓰이며, 백엔드 ai_metadata_json에 저장된다.
    if seed is not None and supports_seed():
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

        raw = base64.b64decode(data[0]["b64_json"])
        if is_vector() or raw.lstrip()[:5] in (b"<?xml", b"<svg "):
            svg = strip_background(raw.decode("utf-8"))
            return rasterize_svg(svg), svg
        return Image.open(BytesIO(raw)).convert("RGBA"), None

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
        OpenRouter 이미지 API에는 해당 파라미터가 없다. 기존 호출부 시그니처를
        유지하려고 인자로만 받고 쓰지 않는다.

    반환: [{"image": Image, "svg": str|None, "seed": int|None,
            "variant_index": int}, ...] (생성 성공분만)
        svg  : 벡터 모델일 때만 채워진다. 배경 path를 제거한 투명 배경 원본으로,
               다운로드·색 치환·편집에 쓴다.
        image: svg를 래스터화한 것. 폰트 합성과 유사도 분석이 이걸 쓴다.
        seed : Recraft 계열은 시드가 없어 None이다.
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
        {
            "image": r[0],
            "svg": r[1],
            "seed": seeds[i] if supports_seed() else None,
            "variant_index": indices[i],
        }
        for i, r in enumerate(results)
        if r is not None
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
