"""심볼 이미지 + 브랜드명 폰트 레이어 합성 모듈 (단일 진입점).

기획서 설계상 이미지 생성 모델(FLUX)은 심볼(도형)만 만들고, 브랜드명 문자는
여기서 오픈 라이선스 폰트로 합성한다. 생성 모델에 글자를 맡기면 오탈자·깨짐이
발생하고 특히 한글은 거의 렌더링되지 않기 때문이다.

배경색은 흰색으로 고정하지 않는다. FLUX가 그린 배경(검정, 유색, 그라데이션 등)이
로고의 분위기·팔레트에 맞춰 의도적으로 나온 색일 수 있으므로, 인접 픽셀끼리 색을
비교하며 번져나가는 방식이 아니라 각 모서리의 "시작 색"과의 거리만 비교하는
고정 기준색 flood-fill로 배경 영역만 찾아내고(_flatten_background), 그 영역의
실제 평균색으로 균일하게 정리한다 — 노이즈·그라데이션 얼룩은 지우되 원래 배경이
검정이면 검정, 파스텔이면 파스텔로, 로고 분위기와 어울리는 색을 그대로 유지한다.
(인접 픽셀 체인 방식도 시도했으나, 심볼 자체가 그라데이션 채색이거나 가장자리가
부드럽게 블러 처리된 경우 그 경계를 타고 심볼 내부까지 배경으로 오인해 지워버리는
문제가 실측에서 확인되어 폐기했다.)

텍스트는 캔버스를 무조건 아래로 늘려 붙이지 않고, 심볼이 실제로 차지하는 영역
(바운딩 박스)을 찾아 그 바로 아래 남는 여백에 우선 넣는다 — 여백이 부족할 때만
필요한 만큼만 같은 배경색으로 캔버스를 확장한다. 그래서 시안마다 심볼 크기·여백에
따라 텍스트 위치가 자연스럽게 달라진다.

유사도 분석(DINOv2+FAISS)은 KIPRIS 콤비네이션(도형+문자) 상표와 비교하므로,
심볼 단독이 아니라 이 모듈을 거친 최종 로고로 검증해야 정확하다.
"""

import os
import random
from typing import Optional

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

# LOGO_FONT_PATH 환경변수가 없을 때 순서대로 시도할 폰트 후보(굵기별).
# 배포 컨테이너(Linux)와 로컬 개발(Windows) 양쪽을 커버하기 위해 여러 경로를 둔다.
# 한글 브랜드명을 지원하려면 이 중 하나가 실제로 존재해야 한다 — 배포 환경에는
# fonts/ 디렉터리에 한글 지원 TTF/OTF(예: Pretendard, Noto Sans KR)를 두고
# LOGO_FONT_PATH로 지정하는 것을 권장한다(그 경우 굵기 다양화는 적용되지 않는다).
_FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
_FONT_CANDIDATES = {
    "bold": [
        os.path.join(_FONT_DIR, "Pretendard-Bold.ttf"),
        os.path.join(_FONT_DIR, "NotoSansKR-Bold.otf"),
        os.path.join(_FONT_DIR, "NanumGothicBold.ttf"),
        "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansKR-Bold.otf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "C:/Windows/Fonts/malgunbd.ttf",
        "C:/Windows/Fonts/malgun.ttf",
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    ],
    "regular": [
        os.path.join(_FONT_DIR, "Pretendard-Regular.ttf"),
        os.path.join(_FONT_DIR, "NotoSansKR-Regular.otf"),
        os.path.join(_FONT_DIR, "NanumGothicBold.ttf"),
        "/usr/share/fonts/truetype/noto/NotoSansKR-Regular.otf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "C:/Windows/Fonts/malgun.ttf",
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    ],
}

# (굵기, 자간(em 단위)) 조합 후보 — 시안마다 이 중 하나를 무작위로 골라 텍스트
# 스타일 자체도 시안 간에 달라지게 한다. (혼합형/심볼+텍스트 케이스에서 사용)
_TEXT_STYLE_POOL = [
    ("bold", 0.0),
    ("bold", 0.12),
    ("regular", 0.0),
    ("regular", 0.2),
]

_font_cache = {}


class FontNotFoundError(RuntimeError):
    """한글 렌더링 가능한 폰트를 찾지 못했을 때."""


def _resolve_font(
    size: int, font_path: Optional[str] = None, weight: str = "bold"
) -> ImageFont.FreeTypeFont:
    candidates = [font_path] if font_path else []
    env_font = os.environ.get("LOGO_FONT_PATH")
    if env_font:
        candidates.append(env_font)
    candidates.extend(_FONT_CANDIDATES.get(weight, _FONT_CANDIDATES["bold"]))

    for path in candidates:
        if not path or not os.path.isfile(path):
            continue
        cache_key = (path, size)
        if cache_key not in _font_cache:
            _font_cache[cache_key] = ImageFont.truetype(path, size)
        return _font_cache[cache_key]

    # 트루타입 폰트를 하나도 못 찾은 경우의 최후 폴백. PIL 내장 비트맵 폰트는 크기
    # 조절이 안 되고 한글도 지원하지 않으므로, 배포 환경에는 반드시 폰트를 둬야 한다.
    return ImageFont.load_default()


def _color_distance(a: tuple, b: tuple) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def _luma(rgb: tuple) -> float:
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]


def _adjust_for_contrast(rgb: tuple, bg_rgb: tuple) -> tuple:
    """배경이 밝으면 텍스트 색을 검정 쪽으로, 배경이 어두우면 흰색 쪽으로 눌러
    최소한의 대비를 보장한다(배경색이 로고마다 달라지므로 고정 타깃을 쓸 수 없다)."""
    bg_luma = _luma(bg_rgb)
    luma = _luma(rgb)
    toward_white = bg_luma < 128
    target = 215 if toward_white else 70

    if toward_white:
        if luma >= target or luma >= 255:
            return rgb
        t = min(max((target - luma) / (255 - luma), 0), 1)
        return tuple(round(c + (255 - c) * t) for c in rgb)

    if luma <= target or luma <= 0:
        return rgb
    t = min(max(1 - (target / luma), 0), 1)
    return tuple(round(c * (1 - t)) for c in rgb)


def _flatten_background(logo: Image.Image, thresh: int = 40):
    """네 모서리에 닿아있는 배경 영역을 찾아, 그 배경의 실제 평균색으로 균일하게
    정리한다. 반환값은 (정리된 이미지, 배경색 RGB 튜플).

    FLUX가 그리는 배경은 완전히 균일하지 않고 미세한 노이즈/텍스처(픽셀별 밝기
    편차)가 섞여 있는 경우가 많다(실측 확인됨). floodfill은 4방향으로 연결된
    픽셀만 번져나가므로, 노이즈 알갱이 하나가 seed 색과의 거리(thresh)를 살짝
    넘기면 그 지점에서 연결이 끊겨 바깥쪽 배경 일부가 사각형/얼룩 모양으로 안
    지워지고 남는 문제가 있었다. floodfill이 번져나갈 영역을 판단할 때만 약하게
    블러링한 사본을 쓰고(노이즈로 인한 연결 끊김 방지), 실제 색 교체는 원본
    선명한 이미지 위에 그 영역(마스크)만큼만 적용해 심볼 디테일은 그대로 둔다.
    """
    rgb = logo.convert("RGB")
    w, h = rgb.size
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    corner_colors = [rgb.getpixel(c) for c in corners]
    bg_rgb = tuple(round(sum(c[i] for c in corner_colors) / 4) for i in range(3))

    smoothed = rgb.filter(ImageFilter.GaussianBlur(radius=2))
    for corner in corners:
        ImageDraw.floodfill(smoothed, corner, bg_rgb, thresh=thresh)

    bg_flat = Image.new("RGB", (w, h), bg_rgb)
    diff = ImageChops.difference(smoothed, bg_flat).convert("L")
    mask = diff.point(lambda p: 0 if p else 255)  # floodfill이 채운(=배경) 영역만 255

    flattened = rgb.copy()
    flattened.paste(bg_flat, (0, 0), mask)
    return flattened, bg_rgb


def _foreground_bbox(rgb: Image.Image, bg_rgb: tuple, thresh: int = 24):
    """배경색과 충분히 다른 픽셀들의 바운딩 박스 — 심볼이 캔버스 안에서 실제로
    차지하는 영역을 알아내, 그 주변 여백에 텍스트를 자연스럽게 배치하는 데 쓴다."""
    bg = Image.new("RGB", rgb.size, bg_rgb)
    diff = ImageChops.difference(rgb, bg).convert("L")
    mask = diff.point(lambda p: 255 if p > thresh else 0)
    return mask.getbbox()


def _dominant_color(rgb: Image.Image, bg_rgb: tuple) -> str:
    """배경이 아닌 대표 색상을 뽑아 텍스트 색으로 쓴다. 배경 밝기에 맞춰 대비를
    보정하므로 어떤 배경색이 나와도 텍스트가 묻히지 않는다."""
    small = rgb.resize((80, 80))
    counts = small.getcolors(80 * 80) or []
    counts.sort(key=lambda c: c[0], reverse=True)

    for count, rgb_val in counts:
        if _color_distance(rgb_val, bg_rgb) > 60:
            r, g, b = _adjust_for_contrast(rgb_val, bg_rgb)
            return f"#{r:02x}{g:02x}{b:02x}"
    return "#ffffff" if _luma(bg_rgb) < 128 else "#1a1a1a"


def _initials(brand_name: str, max_chars: int = 2) -> str:
    """레터마크용 이니셜 추출. 영문은 단어 첫 글자, 한글은 앞 글자를 사용."""
    words = brand_name.split()
    if len(words) >= 2:
        return "".join(w[0] for w in words[:max_chars]).upper()
    return brand_name[:max_chars].upper()


def _text_size(draw: ImageDraw.ImageDraw, text: str, font) -> tuple:
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    return right - left, bottom - top


def _fit_font_to_width(
    draw: ImageDraw.ImageDraw, text: str, target_width: int, font_path: Optional[str]
) -> ImageFont.FreeTypeFont:
    """텍스트가 target_width에 맞도록 폰트 크기를 이분 탐색으로 찾는다. (워드마크/레터마크용)"""
    low, high = 8, 400
    best = _resolve_font(low, font_path)
    while low <= high:
        mid = (low + high) // 2
        font = _resolve_font(mid, font_path)
        width, _ = _text_size(draw, text, font)
        if width <= target_width:
            best = font
            low = mid + 1
        else:
            high = mid - 1
    return best


def compose_logo_with_text(
    logo: Image.Image,
    brand_name: str,
    *,
    font_path: Optional[str] = None,
    text_style: Optional[tuple] = None,
    text_color: Optional[str] = None,
    font_size_ratio: float = 0.17,
    gap_ratio: float = 0.35,
) -> Image.Image:
    """심볼 로고에 브랜드명 텍스트를 자연스럽게 합성한 새 이미지를 반환한다. (혼합형/심볼+텍스트용)

    원본 logo 객체는 변경하지 않는다. 배경색은 흰색으로 고정하지 않고 로고 자체의
    배경(검정/유색/파스텔 등, 프롬프트의 톤·팔레트가 반영된 색)을 그대로 유지하면서
    노이즈만 균일하게 정리한다. 심볼의 실제 바운딩 박스를 찾아 그 아래 남는 여백에
    우선 배치하고, 여백이 모자랄 때만 같은 배경색으로 캔버스를 확장한다. text_style
    (굵기, 자간)과 text_color를 지정하지 않으면 각각 무작위 조합 / 심볼·배경에서
    자동 결정된다. brand_name이 비어 있으면 원본을 그대로 반환한다.
    """
    name = " ".join((brand_name or "").split())
    if not name:
        return logo.convert("RGBA")

    flattened, bg_rgb = _flatten_background(logo)
    width, height = flattened.size

    bbox = _foreground_bbox(flattened, bg_rgb) or (0, 0, width, height)
    left, top, right, bottom = bbox
    symbol_h = max(bottom - top, round(height * 0.3))
    symbol_center_x = (left + right) / 2

    weight, letter_spacing_em = text_style or random.choice(_TEXT_STYLE_POOL)
    resolved_color = text_color or _dominant_color(flattened, bg_rgb)

    font_size = max(14, round(symbol_h * font_size_ratio))
    font = _resolve_font(font_size, font_path, weight)
    gap = max(4, round(font_size * gap_ratio))
    letter_spacing = round(font_size * letter_spacing_em)

    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))

    def _measure(f) -> tuple:
        """자간을 반영한 전체 텍스트 폭/높이. 마지막 글자 뒤 여백은 포함하지 않는다."""
        tbbox = probe.textbbox((0, 0), name, font=f)
        if letter_spacing == 0:
            return tbbox[2] - tbbox[0], tbbox[3] - tbbox[1], tbbox
        total_w = sum(probe.textlength(ch, font=f) for ch in name)
        total_w += letter_spacing * (len(name) - 1)
        return round(total_w), tbbox[3] - tbbox[1], tbbox

    text_w, text_h, tbbox = _measure(font)

    max_text_w = round(width * 0.92)
    shrink_attempts = 0
    while text_w > max_text_w and shrink_attempts < 5 and font_size > 12:
        font_size = round(font_size * 0.85)
        font = _resolve_font(font_size, font_path, weight)
        letter_spacing = round(font_size * letter_spacing_em)
        text_w, text_h, tbbox = _measure(font)
        shrink_attempts += 1

    bottom_breathing_room = round(font_size * 0.3)
    needed_below = gap + text_h + bottom_breathing_room
    available_below = height - bottom

    if available_below >= needed_below:
        # 심볼 아래 여백이 충분함 — 캔버스를 늘리지 않고 그 안에 그대로 넣는다.
        canvas = flattened.copy()
    else:
        # 여백 부족 — 필요한 만큼만 아래로 확장한다.
        extra = needed_below - available_below
        canvas = Image.new("RGB", (width, height + extra), bg_rgb)
        canvas.paste(flattened, (0, 0))

    text_top_y = bottom + gap

    draw = ImageDraw.Draw(canvas)
    half_w = text_w / 2
    text_x_center = min(max(symbol_center_x, half_w + 4), canvas.width - half_w - 4)
    text_y = text_top_y - tbbox[1]

    if letter_spacing == 0:
        draw.text((text_x_center - half_w - tbbox[0], text_y), name, font=font, fill=resolved_color)
    else:
        cursor_x = text_x_center - half_w
        for ch in name:
            draw.text((cursor_x, text_y), ch, font=font, fill=resolved_color)
            cursor_x += probe.textlength(ch, font=font) + letter_spacing

    return canvas.convert("RGBA")


def compose_logos_with_text(logos, brand_name: str, **kwargs):
    """generate_logo_from_survey가 반환하는 여러 시안에 브랜드명을 일괄 합성한다.

    text_style/text_color를 kwargs로 고정하지 않는 한, 시안 각각에 대해
    compose_logo_with_text가 스타일과 색과 배치를 독립적으로 자동 결정한다.
    """
    return [compose_logo_with_text(logo, brand_name, **kwargs) for logo in logos]


def compose_logo(
    symbol: Optional[Image.Image],
    brand_name: str,
    style: str = "혼합형",
    text_color: Optional[str] = None,
    font_path: Optional[str] = None,
) -> Image.Image:
    """심볼과 브랜드명을 합성해 최종 로고를 만든다.

    style별 레이아웃:
      - 심볼    : 심볼만 (텍스트 없음). 배경 노이즈만 정리(_flatten_background).
      - 워드마크 : 브랜드명 텍스트만 (심볼 이미지는 쓰지 않음)
      - 레터마크 : 브랜드명 이니셜만 (심볼 이미지는 쓰지 않음)
      - 혼합형  : 심볼 위 + 브랜드명 아래 (compose_logo_with_text)
    """
    if style == "심볼":
        if symbol is None:
            raise ValueError("심볼 스타일에는 symbol 이미지가 필요합니다.")
        flattened, _ = _flatten_background(symbol)
        return flattened.convert("RGBA")

    if style in ("워드마크", "레터마크"):
        canvas_size = 1024
        canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        text = _initials(brand_name) if style == "레터마크" else brand_name
        font = _fit_font_to_width(draw, text, int(canvas_size * 0.7), font_path)
        tw, th = _text_size(draw, text, font)
        left, top, _, _ = draw.textbbox((0, 0), text, font=font)
        draw.text(
            ((canvas_size - tw) / 2 - left, (canvas_size - th) / 2 - top),
            text,
            font=font,
            fill=text_color or "#1a1a1a",
        )
        return canvas

    # 혼합형 (또는 그 외 스타일) — 심볼+텍스트 합성
    if symbol is None:
        raise ValueError(f"'{style}' 스타일에는 symbol 이미지가 필요합니다.")
    return compose_logo_with_text(symbol, brand_name, font_path=font_path, text_color=text_color)


def _wants_text_overlay(survey: dict, style_key: str, brand_name: str) -> bool:
    """설문 응답을 바탕으로 브랜드명 텍스트를 합성할지 결정한다.

    심볼 스타일은 정의상 텍스트가 없으므로 항상 False. 브랜드명 미입력 시에도
    합성할 텍스트가 없으므로 False. 그 외에는 사용자가 명시적으로 응답한
    텍스트 포함 여부(설문 토글)를 우선하고, 응답이 없으면 워드마크·레터마크·
    혼합형 스타일일 때 기본적으로 텍스트를 포함한다.
    """
    if style_key == "심볼" or not brand_name:
        return False

    explicit = survey.get("include_brand_name_in_logo")
    if explicit is None:
        explicit = survey.get("show_text_in_logo")
    if explicit is not None:
        return bool(explicit)

    return style_key in ("워드마크", "레터마크", "혼합형")


def compose_final_logo(symbol: Image.Image, survey: dict) -> Image.Image:
    """FLUX가 생성한 심볼과 설문 응답을 받아 최종 로고 1장을 만든다.

    app.py의 단일 진입점 — 텍스트 합성 여부 판단부터 배경 정리, compose_logo
    호출까지 이 함수 하나로 처리한다.
    """
    style_key = survey.get("style", "심볼")
    brand_name = " ".join((survey.get("brand_name") or "").strip().split())

    if not _wants_text_overlay(survey, style_key, brand_name):
        flattened, _ = _flatten_background(symbol)
        return flattened.convert("RGBA")

    text_color = survey.get("text_color")
    return compose_logo(symbol, brand_name, style=style_key, text_color=text_color)