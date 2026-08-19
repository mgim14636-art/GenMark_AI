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

def strip_stray_specks(svg: str, min_diag_ratio: float = 0.02) -> str:
    """심볼 사이 빈 공간에 떠 있는, 다른 도형과 이어지지 않은 미세 조각을 지운다.

    Recraft 벡터 응답이 이따금 아이콘 사이 여백에 조형과 무관한 작은 선 조각을
    남긴다(실측: "GlowLab" 잎+물방울 아이콘 - path 8개 중 5개가 캔버스 대각선의
    1% 미만인 스크래치였고, 그중 하나는 눈에 보일 만큼 커서 로고가 "깨진" 것처럼
    보였다). 실제 조형 요소는 실측 최소값(11.86%)에 비해 훨씬 작으므로, 대각선
    비율이 min_diag_ratio 미만인 path는 노이즈로 보고 지운다.

    strip_background 직후, rasterize_svg 이전에 호출해야 한다 - 그래야 래스터
    (PNG)와 벡터(SVG) 출력이 같은 조각을 공유하지 않는다.
    """
    m = re.search(r'viewBox="\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)', svg)
    if not m:
        return svg
    vw, vh = float(m.group(3)), float(m.group(4))
    canvas_diag = (vw ** 2 + vh ** 2) ** 0.5
    if canvas_diag <= 0:
        return svg

    def _is_speck(d: str) -> bool:
        nums = [float(v) for v in re.findall(r"[-\d.]+", d)]
        xs, ys = nums[0::2], nums[1::2]
        if not xs or not ys:
            return False
        diag = ((max(xs) - min(xs)) ** 2 + (max(ys) - min(ys)) ** 2) ** 0.5
        return diag / canvas_diag < min_diag_ratio

    def _sub(mo):
        return "" if _is_speck(mo.group(1)) else mo.group(0)

    return re.sub(r'<path[^>]*\sd="([^"]+)"[^>]*/>', _sub, svg)


# 흰색 계열은 배경·하이라이트로 쓰이므로 색 통일 대상에서 뺀다. 이걸 칠해버리면
# 속을 비워 둔 선 로고의 안쪽이 메워지고, 도형에 뚫어 둔 구멍도 막힌다.
_NEAR_WHITE = re.compile(r"^#(?:fff(?:fff)?|f[ef]f[ef]f[ef])$", re.I)


def _is_paintable(value: str) -> bool:
    v = value.strip().lower()
    if v in ("none", "transparent", "currentcolor", ""):
        return False
    if v.startswith("url("):
        return False
    return not _NEAR_WHITE.match(v)


_RGB_FUNC = re.compile(r"^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)", re.I)

_CSS_KEYWORDS = {"white": 255.0, "black": 0.0}


def _luma(value: str):
    """색 문자열 -> 밝기(0~255). 파싱 못 하면 None.

    Recraft 벡터 응답은 rgb(255,255,255) 표기를 쓴다 - HEX만 보던 초기 구현이
    흰 안쪽 면을 흰색으로 인식하지 못해 전부 잉크색으로 칠해버렸다(실측 확인됨,
    선 로고 4장이 모두 굵은 면 덩어리가 됨). 두 표기를 모두 처리한다.
    """
    v = (value or "").strip().lower()
    if v in _CSS_KEYWORDS:
        return _CSS_KEYWORDS[v]

    mo = _RGB_FUNC.match(v)
    if mo:
        r, g, b = (float(mo.group(i)) for i in (1, 2, 3))
        return 0.299 * r + 0.587 * g + 0.114 * b

    h = v.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return None
    try:
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return None
    return 0.299 * r + 0.587 * g + 0.114 * b


# 이 밝기 이상이면 "안쪽을 비우는 면"으로 보고 흰색으로 만든다.
# Recraft 벡터는 stroke를 쓰지 않고 선까지 채운 도형으로 그린다. 선 스타일 결과는
# [바깥 윤곽 도형(잉크) + 안쪽 면(흰색)] 쌍으로 오는데, 안쪽 면까지 지정색으로
# 칠하면 속이 메워져 면 로고가 된다.
LIGHT_FILL_LUMA = 205.0


def force_single_color(svg: str, hex_color: str) -> str:
    """SVG의 색을 지정색 + 흰색 두 가지로만 정리한다.

    밝은 색(LIGHT_FILL_LUMA 이상)은 흰색으로, 나머지 잉크는 전부 지정색으로 바꾼다.
    밝고 어두운 구조는 남기되 색은 하나로 통일하는 게 목적이다.

    단색 지시는 프롬프트로 보장되지 않는다("single stroke color"를 명시해도 모델이
    보조색을 얹는다). 벡터는 색이 속성값이라 생성 후 확정적으로 바꿀 수 있다.
    """
    if not svg or not hex_color:
        return svg
    color = hex_color.strip()
    if not color.startswith("#") or _luma(color) is None:
        return svg

    def _mapped(value: str):
        v = value.strip().lower()
        if v in ("none", "transparent", "currentcolor", ""):
            return None
        if v.startswith("url("):
            # 그라데이션·패턴 참조. 단색으로 통일하는 게 목적이므로 지정색으로
            # 갈아끼운다. 남겨두면 단색 지정인데 결과에 그라데이션이 남는다.
            return color
        lum = _luma(v)
        if lum is None:
            return None
        return "#ffffff" if lum >= LIGHT_FILL_LUMA else color

    def _attr(mo):
        target = _mapped(mo.group(2))
        return mo.group(1) + target + mo.group(3) if target else mo.group(0)

    svg = re.sub(r'(\b(?:fill|stroke)=")([^"]*)(")', _attr, svg)

    def _style(mo):
        target = _mapped(mo.group(2))
        return mo.group(1) + target if target else mo.group(0)

    return re.sub(r'((?:fill|stroke)\s*:\s*)([^;"}]+)', _style, svg)


def force_palette_colors(svg: str, colors: list[str]) -> str:
    """Map visible SVG inks onto an approved multi-color palette.

    White/transparent holes remain intact. Gradient references are replaced by
    a solid palette color so downloaded SVGs cannot retain an unapproved fill.
    """
    palette = [c.strip() for c in colors if re.fullmatch(r"#[0-9A-Fa-f]{6}", c.strip())]
    if not svg or len(palette) < 2:
        return svg
    index = 0

    def mapped(value: str):
        nonlocal index
        value = value.strip().lower()
        if value in ("", "none", "transparent", "currentcolor"):
            return None
        if value.startswith("url("):
            chosen = palette[index % len(palette)]; index += 1
            return chosen
        lum = _luma(value)
        if lum is None:
            return None
        # Recraft often uses a very pale fill for a hole/highlight. Keep that
        # visual role, but normalize it to white so an arbitrary model color
        # cannot leak outside the user's approved palette.
        if lum >= LIGHT_FILL_LUMA:
            return "#ffffff"
        chosen = palette[index % len(palette)]; index += 1
        return chosen

    def attr(match):
        target = mapped(match.group(2))
        return match.group(1) + target + match.group(3) if target else match.group(0)

    svg = re.sub(r'(\b(?:fill|stroke)=")([^"]*)(")', attr, svg)

    def style(match):
        target = mapped(match.group(2))
        return match.group(1) + target if target else match.group(0)

    return re.sub(r'((?:fill|stroke)\s*:\s*)([^;"}]+)', style, svg)


def _colors_of(survey: dict) -> list:
    """설문에 실제로 담겨 온 색 목록. 로그와 판정이 같은 값을 보게 한다."""
    colors = survey.get("color_manual") or survey.get("colors")
    if isinstance(colors, str):
        colors = [colors]
    result = []
    seen = set()
    for value in (colors or []):
        color = str(value).strip()
        if color and color.casefold() not in seen:
            result.append(color); seen.add(color.casefold())
    return result


def _single_manual_color(survey: dict):
    """확정된 색이 정확히 하나일 때 그 HEX. 아니면 None.

    color_mode(TONE/MANUAL)는 보지 않는다 - prompt_service._manual_color_names와
    같은 규칙이어야 한다. 추천 팔레트를 고른 사용자도 색을 하나로 줄일 수 있고,
    그 경우에도 단색으로 나와야 한다. 두 곳의 판정이 갈리면 프롬프트는 단색이라
    말하는데 결과는 아닌 상태가 된다.
    """
    colors = survey.get("color_manual") or survey.get("colors")
    if isinstance(colors, str):
        colors = [colors]
    colors = _colors_of({"color_manual": colors})
    return colors[0] if len(colors) == 1 else None


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
            svg = strip_stray_specks(svg)
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

    # 사용자가 색을 딱 하나 골랐다면 모델 결과와 무관하게 그 색으로 통일한다.
    forced = _single_manual_color(survey)
    if os.environ.get("LOGO_FORCE_COLOR", "on").strip().lower() in ("off", "0", "false"):
        forced = None  # A/B 비교용 - 모델 원본 색을 그대로 둔다
    print(
        "[logo_gen_service] 색 통일 %s (지정색 %s)"
        % ("적용" if forced else "미적용", _colors_of(survey)),
        flush=True,
    )
    if forced:
        for _i, _r in enumerate(results):
            if _r is None or not _r[1]:
                continue
            _fixed = force_single_color(_r[1], forced)
            results[_i] = (rasterize_svg(_fixed), _fixed)
    elif len(_colors_of(survey)) >= 2:
        for _i, _r in enumerate(results):
            if _r is None or not _r[1]:
                continue
            _fixed = force_palette_colors(_r[1], _colors_of(survey))
            results[_i] = (rasterize_svg(_fixed), _fixed)

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
