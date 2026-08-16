import os
import random
from typing import Optional

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

from app.services.prompt_service import _normalize_survey, _normalize_tone

_TONE_TEXT_COLOR_MAP = {
    "친근하고 다정한": "#F39BBD",
    "전문적이고 신뢰감 있는": "#17185B",
    "감성적이고 따뜻한": "#D29474",
    "유니크하고 트렌디한": "#171713",
    "미니얼하고 직관적인": "#396FC8",
}

# LOGO_FONT_PATH 환경변수가 없을 때 순서대로 시도할 폰트 후보(굵기별).
# 배포 컨테이너(Linux)와 로컬 개발(Windows) 양쪽을 커버하기 위해 여러 경로를 둔다.
# 한글 브랜드명을 지원하려면 이 중 하나가 실제로 존재해야 한다 — 배포 환경에는
# fonts/ 디렉터리에 한글 지원 TTF/OTF(예: Pretendard, Noto Sans KR)를 두고
# LOGO_FONT_PATH로 지정하는 것을 권장한다(그 경우 굵기 다양화는 적용되지 않는다).
#
# [주의] 이 목록은 이제 "고정 우선순위"가 아니라 "후보 풀"로 쓰인다. 실제 어떤 파일이
# 선택되는지는 _pick_random_font_path가 이 중 실제로 존재하는 파일들 중에서 무작위로
# 고른다. LOGO_FONT_PATH 환경변수가 설정돼 있으면 그게 최우선으로 고정 사용된다
# (무작위 선택보다 우선 — 배포 환경에서 특정 폰트로 강제 고정하고 싶을 때 쓴다).
#
# Pretendard/NanumGothic/맑은고딕은 셋 다 "두꺼운 고딕" 계열이라 실제로 다른 파일이
# 골라져도 육안으로는 거의 구분이 안 되는 문제가 있었다(실측 확인됨). 전부 OFL(SIL
# Open Font License) — 상업적 이용 가능. 라이선스 원문은 fonts/licenses/LICENSE-*.txt 참고.
#
# logo_ai_server(Flask 프로토타입)에서는 이 파일과 fonts/가 같은 디렉터리에 있었지만,
# FastAPI 쪽에서는 fonts/를 app/ 바로 밑(app/fonts)에 두므로 한 단계 상위로 올라간다.
_FONT_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts")
)
_FONT_CANDIDATES = {
    "bold": [
        os.path.join(_FONT_DIR, "modern_sans", "bold", "Pretendard-Bold.ttf"),
        os.path.join(_FONT_DIR, "elegant_serif", "bold", "GowunBatang-Bold.ttf"),
        os.path.join(_FONT_DIR, "NotoSansKR-Bold.otf"),
        os.path.join(_FONT_DIR, "modern_sans", "bold", "NanumGothicBold.ttf"),
        "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansKR-Bold.otf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "C:/Windows/Fonts/malgunbd.ttf",
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    ],
    "regular": [
        os.path.join(_FONT_DIR, "modern_sans", "regular", "Pretendard-Regular.ttf"),
        os.path.join(_FONT_DIR, "modern_sans", "regular", "IBMPlexSansKR-Regular.ttf"),
        os.path.join(_FONT_DIR, "elegant_serif", "regular", "GowunBatang-Regular.ttf"),
        os.path.join(_FONT_DIR, "elegant_serif", "regular", "NotoSerifKR-Regular.ttf"),
        os.path.join(_FONT_DIR, "elegant_serif", "regular", "Hahmlet-Regular.ttf"),
        os.path.join(_FONT_DIR, "NotoSansKR-Regular.otf"),
        os.path.join(_FONT_DIR, "modern_sans", "bold", "NanumGothicBold.ttf"),
        "/usr/share/fonts/truetype/noto/NotoSansKR-Regular.otf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "C:/Windows/Fonts/malgun.ttf",
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    ],
    # 2026 뷰티 브랜딩은 얇은 웨이트 + 넓은 자간이 프리미엄 워드마크의 기본 문법이다
    # (The Ordinary, Rhode 등 타이포그래피 우선 아이덴티티). 기존 풀에는 Bold/Regular만
    # 있어 이 인상 자체를 만들 수 없었다.
    "light": [
        os.path.join(_FONT_DIR, "modern_sans", "light", "Pretendard-Light.ttf"),
        os.path.join(_FONT_DIR, "elegant_serif", "light", "NotoSerifKR-Light.ttf"),
        os.path.join(_FONT_DIR, "elegant_serif", "light", "Hahmlet-Light.ttf"),
        os.path.join(_FONT_DIR, "modern_sans", "light", "IBMPlexSansKR-Light.ttf"),
        os.path.join(_FONT_DIR, "modern_sans", "light", "Pretendard-Thin.ttf"),
        # light가 하나도 없는 환경에서도 동작하도록 regular로 자연스럽게 내려간다
        os.path.join(_FONT_DIR, "modern_sans", "regular", "Pretendard-Regular.ttf"),
    ],
}

# 위 기본 풀은 전부 고딕 계열이라 실제로 다른 파일이 골라져도 육안 차이가 거의 없다
# (실측 확인됨). 그렇다고 스타일이 뚜렷한 폰트(명조/손글씨/라운드 디스플레이)를 전부
# 톤 구분 없이 섞으면 프리미엄 스킨케어 로고에 손글씨체가 나오는 등 톤과 안 맞는
# 조합이 나온다(마찬가지로 실측 확인됨). 그래서 prompt_service.TONE_MAP의 5개 톤
# 키마다 그 톤의 분위기와 실제로 어울리는 폰트만 골라 추가한다 — 톤을 하나도 못 가진
# 후보(빈 리스트)가 없도록 5개 전부 최소 1종 이상 채운다.
#   - 친근하고 다정한 : 손글씨(Gaegu)·라운드체(Jua) — 다정하고 편안한 인상
#   - 전문적이고 신뢰감 있는 : 명조/세리프(NanumMyeongjo) — 격식 있고 신뢰감 있는 인상
#   - 감성적이고 따뜻한 : 명조 + 손글씨 — TONE_MAP 원문의 "organic hand-drawn curves"와
#     맞물리는 조합(세리프의 서정성 + 손글씨의 온기)
#   - 유니크하고 트렌디한 : 라운드체 + 손글씨 — 관습적이지 않은 개성 있는 인상
#   - 미니얼하고 직관적인 : 명조 — 장식 없는 세리프는 미니멀 취지를 해치지 않으면서도
#     고딕 일변도에서 벗어나게 해줌 (손글씨/라운드체는 "심플한 여백" 취지와 어긋나 제외)
def _f(*parts) -> str:
    return os.path.join(_FONT_DIR, *parts)


_SERIF_L = _f("elegant_serif", "light", "NotoSerifKR-Light.ttf")
_HAHMLET_L = _f("elegant_serif", "light", "Hahmlet-Light.ttf")
_GOWUN = _f("elegant_serif", "regular", "GowunBatang-Regular.ttf")
_GOWUN_B = _f("elegant_serif", "bold", "GowunBatang-Bold.ttf")
_SERIF_R = _f("elegant_serif", "regular", "NotoSerifKR-Regular.ttf")
_HAHMLET_R = _f("elegant_serif", "regular", "Hahmlet-Regular.ttf")
_MYEONGJO_B = _f("elegant_serif", "bold", "NanumMyeongjo-Bold.ttf")
_MYEONGJO_R = _f("elegant_serif", "regular", "NanumMyeongjo-Regular.ttf")
_PRE_L = _f("modern_sans", "light", "Pretendard-Light.ttf")
_PLEX_L = _f("modern_sans", "light", "IBMPlexSansKR-Light.ttf")
_PLEX_R = _f("modern_sans", "regular", "IBMPlexSansKR-Regular.ttf")
_GAEGU = _f("Gaegu-Bold.ttf")
_JUA = _f("Jua-Regular.ttf")

TONE_FONT_BIAS = {
    "친근하고 다정한": {
        "light": [_PRE_L, _PLEX_L],
        "regular": [_JUA, _PLEX_R],
        "bold": [_GAEGU, _JUA],
    },
    "전문적이고 신뢰감 있는": {
        "light": [_PLEX_L, _SERIF_L],
        "regular": [_PLEX_R, _SERIF_R],
        "bold": [_MYEONGJO_B],
    },
    "감성적이고 따뜻한": {
        # 우아한 세리프 계열. 나눔명조보다 고운바탕·Noto Serif가 훨씬 세련된 인상을 준다.
        "light": [_SERIF_L, _HAHMLET_L],
        "regular": [_GOWUN, _SERIF_R],
        "bold": [_GOWUN_B, _MYEONGJO_B],
    },
    "유니크하고 트렌디한": {
        "light": [_HAHMLET_L, _PRE_L],
        "regular": [_HAHMLET_R, _JUA],
        "bold": [_JUA, _GAEGU],
    },
    "미니얼하고 직관적인": {
        # 얇은 산세리프 + 넓은 자간 = 2026 프리미엄 워드마크의 기본형
        "light": [_PRE_L, _PLEX_L],
        "regular": [_PLEX_R, _GOWUN],
        "bold": [_MYEONGJO_B],
    },
}

# (굵기, 자간(em 단위)) 조합 후보.
#
# 자간 상한을 0.2em -> 0.45em으로 올렸다. 프리미엄 뷰티 워드마크는 "L U N E R I A"
# 처럼 글자를 넓게 벌려 여백으로 격을 만드는데, 0.2em으로는 그 인상이 나오지 않는다.
# light 웨이트도 함께 넣어 "얇은 글자 + 넓은 자간" 조합이 실제로 나오게 했다.
_TEXT_STYLE_POOL = [
    ("light", 0.45),
    ("light", 0.30),
    ("regular", 0.22),
    ("regular", 0.0),
    ("bold", 0.12),
    ("bold", 0.0),
]

# 톤별로 어울리는 (굵기, 자간) 조합. 무작위 대신 이 목록을 variant_index로 순환해
# 같은 설문이면 같은 결과가 나오게 한다 — 재생성 회차마다 조합이 바뀌되 예측 가능하다.
TONE_TEXT_STYLES = {
    "친근하고 다정한": [("regular", 0.10), ("bold", 0.06), ("regular", 0.0), ("light", 0.20)],
    "전문적이고 신뢰감 있는": [("light", 0.30), ("regular", 0.22), ("light", 0.40), ("regular", 0.12)],
    "감성적이고 따뜻한": [("light", 0.40), ("regular", 0.28), ("light", 0.30), ("regular", 0.18)],
    "유니크하고 트렌디한": [("bold", 0.0), ("light", 0.45), ("regular", 0.30), ("bold", 0.10)],
    "미니얼하고 직관적인": [("light", 0.45), ("light", 0.35), ("regular", 0.25), ("light", 0.25)],
}

_font_cache = {}


class FontNotFoundError(RuntimeError):
    """한글 렌더링 가능한 폰트를 찾지 못했을 때."""


def _existing_font_candidates(weight: str, tone: str = "") -> list:
    """해당 굵기 후보 목록 중 실제로 디스크에 존재하는 파일 경로만 걸러서 반환한다.

    tone이 TONE_FONT_BIAS에 있으면 그 톤과 어울리는 폰트를 후보 앞쪽에 추가로
    섞는다 — 5개 톤 전부 기본 고딕 풀 + 최소 1종의 스타일 폰트를 갖도록 채워져
    있어(TONE_FONT_BIAS 정의부 참고), 특정 톤(예전의 "친근/트렌디"만)만 다양하고
    나머지 톤은 밋밋한 고딕만 나오는 일이 없다. 동시에 톤과 안 맞는 조합(프리미엄
    로고에 손글씨체 등)은 여전히 섞이지 않는다.
    """
    candidates = list(_FONT_CANDIDATES.get(weight, _FONT_CANDIDATES["bold"]))
    bias = TONE_FONT_BIAS.get(_normalize_tone(tone), {})
    candidates = bias.get(weight, []) + candidates
    return [p for p in candidates if p and os.path.isfile(p)]


def _pick_font_path(weight: str, tone: str = "", variant_index: Optional[int] = None) -> Optional[str]:
    """해당 굵기(및 톤)에서 실제로 존재하는 폰트 파일 중 하나를 고른다.

    variant_index를 주면 후보 목록을 그 값으로 순환 선택한다 — 같은 설문을 다시
    돌리면 같은 폰트가 나오고, 시안 간에는 서로 다른 폰트가 배정된다. 예전에는
    무조건 random.choice라 같은 입력에도 매번 폰트가 바뀌어 결과를 재현할 수 없었다.

    존재하는 후보가 하나도 없으면 None을 반환하고, 이 경우 _resolve_font가
    ImageFont.load_default()로 최종 폴백한다.
    """
    candidates = _existing_font_candidates(weight, tone)
    if not candidates:
        return None
    if variant_index is None:
        return random.choice(candidates)
    return candidates[variant_index % len(candidates)]


def _pick_text_style(tone: str = "", variant_index: Optional[int] = None) -> tuple:
    """(굵기, 자간) 조합을 고른다. 톤 목록이 있으면 그 안에서 순환한다."""
    pool = TONE_TEXT_STYLES.get(_normalize_tone(tone)) or _TEXT_STYLE_POOL
    if variant_index is None:
        return random.choice(pool)
    return pool[variant_index % len(pool)]


# 하위 호환 — 기존 이름으로 부르는 코드가 남아 있을 수 있다
_pick_random_font_path = _pick_font_path


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


def _resolve_font_path_for_call(
    font_path: Optional[str], weight: str, tone: str = "",
    variant_index: Optional[int] = None,
) -> Optional[str]:
    """이번 로고 한 장을 그리는 동안 고정해서 쓸 폰트 경로를 정한다.

    우선순위: (1) 호출부가 직접 넘긴 font_path, (2) LOGO_FONT_PATH 환경변수(배포
    환경에서 특정 폰트로 고정하고 싶을 때), (3) 톤에 맞는 후보 중 무작위 선택.
    여기서 정한 경로를 폰트 크기를 조정하는 동안(이분 탐색/축소 루프) 계속 재사용해야
    폭 계산과 실제 그리기에 쓰이는 폰트가 어긋나지 않는다.
    """
    if font_path:
        return font_path
    env_font = os.environ.get("LOGO_FONT_PATH")
    if env_font:
        return env_font
    return _pick_font_path(weight, tone, variant_index)


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


def _composite_on_white(image: Image.Image) -> Image.Image:
    """투명 배경을 흰색 위에 합성해 RGB로 만든다.

    logo_gen_service.strip_background()가 SVG 배경 path를 제거해 투명 배경을
    돌려준다(다운로드·색 치환 편집용). 그 이미지를 그대로 convert("RGB")하면
    투명 픽셀이 (0,0,0)이 되고, 아래 _flatten_background는 모서리 색으로 배경을
    추정하므로 캔버스 전체를 검정으로 칠해버린다(실측 확인됨 — 선 스타일 결과의
    86%가 검정). 알파가 있으면 흰색과 먼저 합성한다.
    """
    has_alpha = image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    )
    if not has_alpha:
        return image.convert("RGB")
    rgba = image.convert("RGBA")
    canvas = Image.new("RGB", rgba.size, (255, 255, 255))
    canvas.paste(rgba, mask=rgba.getchannel("A"))
    return canvas


def _flatten_background(logo: Image.Image, thresh: int = 40):
    """네 모서리에 닿아있는 배경 영역을 찾아, 그 배경의 실제 평균색으로 균일하게
    정리한다. 반환값은 (정리된 이미지, 배경색 RGB 튜플).

    생성 모델이 그리는 배경은 완전히 균일하지 않고 미세한 노이즈/텍스처(픽셀별 밝기
    편차)가 섞여 있는 경우가 많다(실측 확인됨). floodfill은 4방향으로 연결된
    픽셀만 번져나가므로, 노이즈 알갱이 하나가 seed 색과의 거리(thresh)를 살짝
    넘기면 그 지점에서 연결이 끊겨 바깥쪽 배경 일부가 사각형/얼룩 모양으로 안
    지워지고 남는 문제가 있었다. floodfill이 번져나갈 영역을 판단할 때만 약하게
    블러링한 사본을 쓰고(노이즈로 인한 연결 끊김 방지), 실제 색 교체는 원본
    선명한 이미지 위에 그 영역(마스크)만큼만 적용해 심볼 디테일은 그대로 둔다.
    """
    rgb = _composite_on_white(logo)
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
    """텍스트가 target_width에 맞도록 폰트 크기를 이분 탐색으로 찾는다. (워드마크/레터마크용)

    font_path는 호출부(compose_logo)가 _resolve_font_path_for_call로 이미 확정해
    넘긴 값이라, 이분 탐색 도중에는 이 경로 하나로 고정해서 크기만 바꿔가며 잰다.
    """
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
    font_size_ratio: float = 0.115,
    gap_ratio: float = 0.55,
    tone: str = "",
    variant_index: Optional[int] = None,
) -> Image.Image:
    """심볼 로고에 브랜드명 텍스트를 자연스럽게 합성한 새 이미지를 반환한다. (혼합형/심볼+텍스트용)

    원본 logo 객체는 변경하지 않는다. 배경색은 흰색으로 고정하지 않고 로고 자체의
    배경(검정/유색/파스텔 등, 프롬프트의 톤·팔레트가 반영된 색)을 그대로 유지하면서
    노이즈만 균일하게 정리한다. 심볼의 실제 바운딩 박스를 찾아 그 아래 남는 여백에
    우선 배치하고, 여백이 모자랄 때만 같은 배경색으로 캔버스를 확장한다. text_style
    (굵기, 자간)과 text_color를 지정하지 않으면 각각 무작위 조합 / 심볼·배경에서
    자동 결정된다. font_path를 지정하지 않으면 폰트 패밀리 자체도(존재하는 후보 중)
    무작위로 고른다 — tone을 넘기면 그 톤과 어울리는 후보 안에서만 고른다(예:
    "친근하고 다정한"·"유니크하고 트렌디한"일 때만 손글씨/라운드체가 섞인다).
    brand_name이 비어 있으면 원본을 그대로 반환한다.
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

    weight, letter_spacing_em = text_style or _pick_text_style(tone, variant_index)
    resolved_color = text_color or _dominant_color(flattened, bg_rgb)
    # 이 로고 한 장을 그리는 동안 폰트 경로를 한 번만 정하고 계속 재사용한다 —
    # 축소 루프 중간에 폰트가 바뀌면 폭 계산이 어긋나 텍스트가 잘리거나 넘칠 수 있다.
    resolved_font_path = _resolve_font_path_for_call(font_path, weight, tone, variant_index)

    # 글자 크기는 캔버스 폭을 기준으로 잡는다.
    #
    # 예전에는 심볼의 바운딩 박스 높이(symbol_h)에 비례시켰다. 심볼이 항상 캔버스를
    # 꽉 채우던 시절에는 문제가 없었지만, 여백을 둔 마크가 들어오면서 브랜드명이
    # 같이 쪼그라들어 시안마다 글자 크기가 제각각이 됐다(실측 확인됨 — 같은 4시안
    # 안에서도 눈에 띄게 차이 남). 캔버스 기준이면 어떤 심볼이 와도 일정하다.
    font_size = max(14, round(width * font_size_ratio))
    font = _resolve_font(font_size, resolved_font_path, weight)
    # 심볼과 글자 사이 여백도 글자 크기에 비례시켜, 얇은 웨이트일 때 답답해 보이지 않게 한다.
    gap = max(6, round(font_size * gap_ratio))
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
        font = _resolve_font(font_size, resolved_font_path, weight)
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

    text_style/text_color/font_path를 kwargs로 고정하지 않는 한, 시안 각각에 대해
    compose_logo_with_text가 스타일·색·폰트·배치를 독립적으로 자동 결정한다.
    """
    return [compose_logo_with_text(logo, brand_name, **kwargs) for logo in logos]


def compose_logo(
    symbol: Optional[Image.Image],
    brand_name: str,
    style: str = "혼합형",
    text_color: Optional[str] = None,
    font_path: Optional[str] = None,
    tone: str = "",
    variant_index: Optional[int] = None,
) -> Image.Image:
    """심볼과 브랜드명을 합성해 최종 로고를 만든다.

    style별 레이아웃:
      - 심볼    : 심볼만 (텍스트 없음). 배경 노이즈만 정리(_flatten_background).
      - 워드마크 : 브랜드명 텍스트만 (심볼 이미지는 쓰지 않음)
      - 레터마크 : 브랜드명 이니셜만 (심볼 이미지는 쓰지 않음)
      - 혼합형  : 심볼 위 + 브랜드명 아래 (compose_logo_with_text)

    tone(설문의 톤)을 넘기면 폰트 후보도 그 톤에 맞춰 고른다 — 자세한 기준은
    _existing_font_candidates 참고. variant_index를 함께 넘기면 폰트·자간이 무작위가
    아니라 그 값으로 순환 선택돼, 같은 설문을 다시 돌려도 같은 결과가 나온다.
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
        # 워드마크/레터마크는 항상 "bold" 굵기를 써왔으므로(_fit_font_to_width의
        # 기존 동작과 동일하게) weight="bold" 기준으로 폰트 경로를 무작위 선택한다.
        resolved_font_path = _resolve_font_path_for_call(font_path, "bold", tone, variant_index)
        font = _fit_font_to_width(draw, text, int(canvas_size * 0.7), resolved_font_path)
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
    return compose_logo_with_text(
        symbol, brand_name, font_path=font_path, text_color=text_color, tone=tone,
        variant_index=variant_index,
    )


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


def _resolve_text_color(survey: dict, tone: str) -> str:
    """Choose text color from explicit, manual, then tone-derived palette values."""
    explicit = survey.get("text_color")
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip()

    manual = survey.get("color_manual") or survey.get("colors")
    if isinstance(manual, str):
        manual = [manual]
    if manual:
        first = str(manual[0]).strip()
        if first:
            return first

    return _TONE_TEXT_COLOR_MAP.get(tone, "#1a1a1a")


def compose_final_logo(
    symbol: Optional[Image.Image], survey: dict, variant_index: Optional[int] = None
) -> Image.Image:
    """생성 모델이 만든 심볼과 설문 응답을 받아 최종 로고 1장을 만든다.

    라우트(app/api/routes/generation.py)의 단일 진입점 — 텍스트 합성 여부 판단부터
    배경 정리, compose_logo 호출까지 이 함수 하나로 처리한다.

    survey는 CI/BI 어느 화면의 원본 필드명(company_name 등)으로 와도 되고 이미
    정규화된 형태(brand_name)로 와도 된다 — prompt_service._normalize_survey를
    그대로 재사용해 이 함수 안에서 한 번 더 정규화하므로, 호출부가
    build_prompt_from_survey에 넘긴 것과 같은 survey를 그대로 넘기기만 하면
    brand_name 필드명 차이로 텍스트 합성이 조용히 스킵되는 문제가 생기지 않는다.
    """
    survey = _normalize_survey(survey)
    style_key = survey.get("style", "심볼")
    brand_name = " ".join((survey.get("brand_name") or "").strip().split())

    if not _wants_text_overlay(survey, style_key, brand_name):
        flattened, _ = _flatten_background(symbol)
        return flattened.convert("RGBA")

    tone = survey.get("tone", "")
    text_color = _resolve_text_color(survey, tone)
    return compose_logo(
        symbol, brand_name, style=style_key, text_color=text_color, tone=tone,
        variant_index=variant_index,
    )
