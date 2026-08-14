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

    변환기가 두 가지인 이유
        cairosvg가 품질이 좋지만 네이티브 Cairo(libcairo-2.dll)를 요구해서
        Windows에서 자주 막힌다. svglib+reportlab도 결국 renderPM이 rlPyCairo를
        찾아 같은 벽에 부딪힌다(실측). 팀원 환경마다 설치가 되고 안 되고 하면
        측정 자체를 못 하므로, 의존성 없는 PIL 구현으로 떨어지게 해 둔다.
        Docker(리눅스)에서는 cairosvg가 정상 동작하므로 서비스 품질에는 영향이 없다.
    """
    try:
        import cairosvg
    except (ImportError, OSError):
        return _rasterize_svg_pil(svg, size)

    png = cairosvg.svg2png(
        bytestring=svg.encode("utf-8"), output_width=size, output_height=size
    )
    return Image.open(BytesIO(png)).convert("RGBA")


_NUM = re.compile(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?")
_CMD = re.compile(r"([MmLlHhVvCcSsQqTtZz])([^MmLlHhVvCcSsQqTtZzAa]*)")


def _flatten_path(d: str, steps: int = 16):
    """SVG path의 d 속성을 다각형 목록으로 편다.

    베지어 곡선을 직선 조각으로 근사한다. steps=16이면 1024px 캔버스에서
    육안으로 곡선과 구분되지 않는다.

    호(A/a) 명령은 지원하지 않는다 — Recraft 벡터 응답은 M/L/C/Z만 쓴다
    (실측). 정규식에서 아예 제외해 조용히 틀린 도형이 나오는 것을 막는다.
    """
    polys, pts = [], []
    cx = cy = sx = sy = 0.0
    prev_ctrl = None

    def cubic(p0, p1, p2, p3):
        for i in range(1, steps + 1):
            t = i / steps
            u = 1 - t
            yield (u**3 * p0[0] + 3 * u * u * t * p1[0]
                   + 3 * u * t * t * p2[0] + t**3 * p3[0],
                   u**3 * p0[1] + 3 * u * u * t * p1[1]
                   + 3 * u * t * t * p2[1] + t**3 * p3[1])

    for cmd, argstr in _CMD.findall(d):
        nums = [float(v) for v in _NUM.findall(argstr)]
        rel = cmd.islower()
        c = cmd.upper()

        if c == "Z":
            if len(pts) > 2:
                polys.append(pts)
            pts = []
            cx, cy = sx, sy
            prev_ctrl = None
            continue

        step = {"M": 2, "L": 2, "H": 1, "V": 1, "C": 6, "S": 4, "Q": 4, "T": 2}[c]
        for k in range(0, len(nums) - step + 1, step):
            a = nums[k:k + step]
            if c == "M":
                x, y = (cx + a[0], cy + a[1]) if rel else (a[0], a[1])
                if len(pts) > 2:
                    polys.append(pts)
                pts = [(x, y)]
                cx = cy = None  # noqa — 아래에서 바로 채운다
                cx, cy = x, y
                sx, sy = x, y
                c = "L"          # M 뒤에 좌표가 이어지면 L로 취급 (SVG 규약)
                prev_ctrl = None
            elif c == "L":
                x, y = (cx + a[0], cy + a[1]) if rel else (a[0], a[1])
                pts.append((x, y)); cx, cy = x, y; prev_ctrl = None
            elif c == "H":
                x = cx + a[0] if rel else a[0]
                pts.append((x, cy)); cx = x; prev_ctrl = None
            elif c == "V":
                y = cy + a[0] if rel else a[0]
                pts.append((cx, y)); cy = y; prev_ctrl = None
            elif c in ("C", "S"):
                if c == "C":
                    p1 = (cx + a[0], cy + a[1]) if rel else (a[0], a[1])
                    p2 = (cx + a[2], cy + a[3]) if rel else (a[2], a[3])
                    p3 = (cx + a[4], cy + a[5]) if rel else (a[4], a[5])
                else:
                    p1 = (2 * cx - prev_ctrl[0], 2 * cy - prev_ctrl[1]) if prev_ctrl else (cx, cy)
                    p2 = (cx + a[0], cy + a[1]) if rel else (a[0], a[1])
                    p3 = (cx + a[2], cy + a[3]) if rel else (a[2], a[3])
                pts.extend(cubic((cx, cy), p1, p2, p3))
                prev_ctrl = p2; cx, cy = p3
            elif c in ("Q", "T"):
                if c == "Q":
                    q = (cx + a[0], cy + a[1]) if rel else (a[0], a[1])
                    p3 = (cx + a[2], cy + a[3]) if rel else (a[2], a[3])
                else:
                    q = (2 * cx - prev_ctrl[0], 2 * cy - prev_ctrl[1]) if prev_ctrl else (cx, cy)
                    p3 = (cx + a[0], cy + a[1]) if rel else (a[0], a[1])
                # 2차 -> 3차 베지어로 승격해서 같은 코드로 처리
                p1 = (cx + 2 / 3 * (q[0] - cx), cy + 2 / 3 * (q[1] - cy))
                p2 = (p3[0] + 2 / 3 * (q[0] - p3[0]), p3[1] + 2 / 3 * (q[1] - p3[1]))
                pts.extend(cubic((cx, cy), p1, p2, p3))
                prev_ctrl = q; cx, cy = p3

    if len(pts) > 2:
        polys.append(pts)
    return polys


def _rasterize_svg_pil(svg: str, size: int) -> Image.Image:
    """cairosvg를 못 쓸 때의 대체 경로. 외부 의존성이 전혀 없다.

    Windows에서 SVG 래스터화는 대부분 네이티브 Cairo를 요구한다
    (cairosvg -> libcairo, reportlab renderPM -> rlPyCairo). 팀원 환경마다
    설치가 막히는 걸 겪어서, Recraft가 실제로 내보내는 범위만 직접 그린다.

    지원 범위: <path d fill transform="translate(x,y)">.
    Recraft 벡터 응답은 이 형태만 쓴다. 그 외 요소가 섞이면 조용히 빠지므로,
    품질이 중요한 곳에서는 cairosvg가 있는 환경을 쓰는 편이 낫다.
    """
    from PIL import ImageDraw

    m = re.search(r'viewBox="\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)', svg)
    vx, vy, vw, vh = (float(m.group(i)) for i in (1, 2, 3, 4)) if m else (0, 0, 1024, 1024)
    sx, sy = size / (vw or 1), size / (vh or 1)

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for tag in re.findall(r"<path\b[^>]*/?>", svg):
        dm = re.search(r'\sd="([^"]+)"', tag)
        if not dm:
            continue
        fm = re.search(r'fill="rgb\((\d+),\s*(\d+),\s*(\d+)\)"', tag)
        if fm:
            fill = (int(fm.group(1)), int(fm.group(2)), int(fm.group(3)), 255)
        else:
            hm = re.search(r'fill="#([0-9A-Fa-f]{6})"', tag)
            if hm:
                h = hm.group(1)
                fill = (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
            elif re.search(r'fill="none"', tag):
                continue
            else:
                fill = (0, 0, 0, 255)

        tm = re.search(r'transform="translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)', tag)
        tdx, tdy = (float(tm.group(1)), float(tm.group(2))) if tm else (0.0, 0.0)

        for poly in _flatten_path(dm.group(1)):
            if len(poly) < 3:
                continue
            draw.polygon(
                [((x + tdx - vx) * sx, (y + tdy - vy) * sy) for x, y in poly],
                fill=fill,
            )
    return img


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
    num_variants: int = 1,
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
    num_variants: int = 1,
    steps: int = 4,
    variant_offset: int = 0,
):
    """이미지 리스트만 필요한 호출부(스크립트 등)를 위한 얇은 래퍼."""
    return [
        v["image"]
        for v in generate_logo_variants(survey, num_variants, steps, variant_offset)
    ]
