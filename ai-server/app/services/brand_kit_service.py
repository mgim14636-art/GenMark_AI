"""브랜드킷(F14) 합성 서비스.

설계 전제(BUSINESS_CARD 한정) — 로고를 이미지 생성 모델에 통째로 넣지 않는다.
디퓨전 모델은 입력 로고를 그대로 재현하지 못한다. 브랜드 아이덴티티 산출물에서
사용자의 로고가 변형돼 나오면 기능 자체가 무의미해지므로, 명함은 배경만 생성하고
로고는 PIL로 정확히 얹는다. 이 방침은 기획서 (7) 수행방법의 'CI 명함: 정보 정확도
확보를 위해 이미지 생성 모델 미사용' 항목과 동일하다.

PRODUCT_THUMBNAIL은 준비된 제품 목업 사진 한 장과 실제 로고, 크기·위치 가이드를
AI 이미지 편집 모델에 함께 전달한다. 요청 한 번에 목업 한 장만 생성하며, 제품명과
헤드라인 카피는 정확도가 필요해 PIL로 따로 얹는다.

현재 구현 상태:
    BUSINESS_CARD      템플릿 합성으로 최종 품질까지 구현 (외부 API 불필요)
    PRODUCT_THUMBNAIL  실제 로고를 제품 목업 한 장에 AI 편집으로 합성 + 제품명/
                       헤드라인은 PIL로 합성. AI 호출이 실패하면 톤 기반 그라데이션 +
                       중앙 로고로 대체하고 응답에 preliminary=True로 표시한다.
"""
import base64
import binascii
import os
import re
import time
from io import BytesIO
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from app.core.exceptions import BrandKitInvalidImage
from app.schemas.brand_kit import (
    CATEGORY_LABEL,
    HEADLINE_MAX_CHARS,
    KIT_SIZE,
    TEXT_AREA_LIMIT,
    BrandKitImage,
    BrandKitRequest,
    BrandKitResponse,
    CardInfo,
)
from app.services.logo_composer import _resolve_font

_DATA_URI = re.compile(r"^data:image/[a-zA-Z0-9.+-]+;base64,")
_HEX = re.compile(r"^#?([0-9a-fA-F]{6})$")

# 설문에 쓸 만한 색이 하나도 없을 때 쓰는 중립 강조색(짙은 남색).
_DEFAULT_ACCENT = (38, 46, 66)

# 배경으로 볼 색 거리 허용치. 연결성 조건이 함께 걸리므로 넉넉히 잡아도
# 로고 안쪽 면이 뚫리지 않는다.
_BG_TOLERANCE = 22


# --------------------------------------------------------------------------- 입력
def _decode_logo(src: str) -> Image.Image:
    src = _DATA_URI.sub("", (src or "").strip())
    if not src:
        raise BrandKitInvalidImage("logo_image_base64 is empty.")
    try:
        raw = base64.b64decode(src, validate=True)
    except (binascii.Error, ValueError) as e:
        raise BrandKitInvalidImage(f"Base64 decode failed: {e}")
    try:
        img = Image.open(BytesIO(raw))
        img.load()
    except Exception as e:
        raise BrandKitInvalidImage(f"Not a readable image: {e}")
    if img.width < 8 or img.height < 8:
        raise BrandKitInvalidImage("Logo image is too small.")
    return img


def _pick_accent(survey: dict) -> Tuple[int, int, int]:
    """설문의 지정 색상 중 첫 번째를 강조색으로 쓴다.

    백엔드는 colors, /generate 스키마는 color_manual로 보내므로 둘 다 본다.
    """
    for key in ("colors", "color_manual", "colorManual"):
        values = survey.get(key)
        if isinstance(values, str):
            values = [values]
        if not isinstance(values, (list, tuple)):
            continue
        for v in values:
            m = _HEX.match(str(v).strip())
            if m:
                h = m.group(1)
                return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    return _DEFAULT_ACCENT


def _brand_name(survey: dict) -> str:
    for key in ("company_name", "brand_name", "companyName", "brandName"):
        v = survey.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _tone(survey: dict) -> str:
    v = survey.get("tone")
    return v if isinstance(v, str) else ""


# --------------------------------------------------------------------------- 로고 처리
def _logo_rgba(logo: Image.Image) -> Image.Image:
    """로고의 균일 배경을 투명으로 바꿔 임의의 바탕 위에 얹을 수 있게 한다.

    /generate가 내보내는 로고는 흰 배경 PNG(logo_composer.compose_final_logo)라
    그대로 컬러 배경에 붙이면 흰 사각형이 그대로 보인다. 원본이 이미 알파를 가진
    경우에는 건드리지 않는다.
    """
    if logo.mode in ("RGBA", "LA") and logo.getchannel("A").getextrema()[0] < 250:
        return logo.convert("RGBA")

    rgb = logo.convert("RGB")
    arr = np.asarray(rgb, dtype=np.int16)

    corners = [arr[0, 0], arr[0, -1], arr[-1, 0], arr[-1, -1]]
    bg = np.mean(corners, axis=0)

    # 1) 배경색에 가까운 픽셀을 먼저 이진화한다.
    #    원본 픽셀값을 직접 floodfill하면 배경의 미세 노이즈에서 연결이 끊겨
    #    배경 일부가 회색 얼룩으로 남는다(실측: 1024x1133 로고에서 배경의 약 24%가
    #    지워지지 않음). 이진화해두면 노이즈가 흡수돼 연결이 끊기지 않는다.
    near_bg = np.abs(arr - bg).max(axis=2) <= _BG_TOLERANCE

    # 2) 그중 '이미지 테두리와 연결된' 영역만 배경으로 본다.
    #    색 거리만으로 판정하면 로고 안쪽의 옅은 면(연분홍·아이보리 등)까지 뚫린다
    #    (실측 확인됨 — 방패 로고의 연분홍 면에 구멍이 났다). 안쪽 면은 외곽선에
    #    둘러싸여 테두리와 연결되지 않으므로 연결성 조건이 이를 지켜준다.
    h, w = near_bg.shape
    padded = np.zeros((h + 2, w + 2), dtype=np.uint8)
    padded[1:-1, 1:-1] = near_bg * 255
    padded[0, :] = padded[-1, :] = padded[:, 0] = padded[:, -1] = 255  # 1px 프레임으로 테두리 연결

    # .copy() 필수 — fromarray가 넘파이 버퍼를 읽기 전용으로 공유해서, 복사하지 않으면
    # floodfill이 아무 예외 없이 무시되고 배경이 통째로 남는다(실측 확인됨).
    flood = Image.fromarray(padded, "L").copy()
    ImageDraw.floodfill(flood, (0, 0), 128, thresh=0)
    background = np.asarray(flood)[1:-1, 1:-1] == 128

    rgba = rgb.convert("RGBA")
    rgba.putalpha(Image.fromarray(np.where(background, 0, 255).astype(np.uint8), "L"))
    return rgba


# 이 밝기 이상이면 "비어 있어야 할 면"으로 본다.
# Recraft 벡터는 stroke 없이 채운 도형으로 그려서, 글자 속·도형 안쪽이 흰색 path로
# 온다. 흰 배경에서는 안 보이지만 유색 명함 위에 얹으면 흰 덩어리로 드러난다
# (실측 확인됨 - 진한 청록 명함에서 워드마크가 흰 글자로 뒤집혀 보였다).
_WHITE_KNOCKOUT_LUMA = 245


def knockout_white(rgba: Image.Image) -> Image.Image:
    """흰색에 가까운 불투명 픽셀을 투명하게 만든다.

    _logo_rgba는 "테두리와 연결된" 영역만 지운다 - 로고 안쪽 연한 면에 구멍이
    나는 걸 막기 위해서다. 유색 바탕에 얹을 때는 반대로 안쪽 흰 면도 비워야
    바탕색이 비쳐 로고가 제대로 읽힌다. 흰색만 대상으로 하므로 아이보리·연분홍
    같은 의미 있는 옅은 면은 건드리지 않는다.
    """
    rgba = rgba.convert("RGBA")
    arr = np.asarray(rgba, dtype=np.int16)
    luma = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
    alpha = np.asarray(rgba.getchannel("A"), dtype=np.uint8)
    alpha = np.where(luma >= _WHITE_KNOCKOUT_LUMA, 0, alpha).astype(np.uint8)
    out = rgba.copy()
    out.putalpha(Image.fromarray(alpha, "L"))
    return out


def _trim(img: Image.Image) -> Image.Image:
    bbox = img.getchannel("A").getbbox() if img.mode == "RGBA" else img.getbbox()
    return img.crop(bbox) if bbox else img


def _fit(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    ratio = min(max_w / img.width, max_h / img.height)
    if ratio <= 0:
        return img
    size = (max(1, int(img.width * ratio)), max(1, int(img.height * ratio)))
    return img.resize(size, Image.LANCZOS)


def _readable_on(bg: Tuple[int, int, int]) -> Tuple[int, int, int]:
    luma = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]
    return (28, 32, 40) if luma > 150 else (255, 255, 255)


# --------------------------------------------------------------------------- 명함
# 명함 렌더링은 business_card.py(담당: 정혜리)에 위임한다.
#
# 한동안 이 파일에도 자체 명함 합성(좌우 2단 1063x591)이 있었으나, 앞/뒷면 분리와
# 쇼케이스 연출까지 갖춘 business_card.py 쪽이 완성도가 높아 그쪽으로 통일했다.
# 엔드포인트(/api/v1/generation/brand-kit)와 응답 스키마는 그대로라 백엔드는
# 수정할 것이 없다.
#
# 사용자 정보(CardInfo)와 business_card.contact dict는 필드명이 다르다.
# 스키마를 서로 맞추는 대신 여기서 변환한다 — 백엔드 계약(CardInfo)과 렌더러의
# 내부 표현을 각자 바꿀 수 있게 두는 편이 낫다.
_FONT_DIR = Path(__file__).resolve().parent.parent / "fonts" / "modern_sans"
_CARD_FONT_BOLD = str(_FONT_DIR / "bold" / "Pretendard-Bold.ttf")
_CARD_FONT_REGULAR = str(_FONT_DIR / "regular" / "Pretendard-Regular.ttf")


def _card_contact(info: Optional[CardInfo]) -> dict:
    if info is None:
        return {}
    return {
        "title": (info.title or "").strip(),
        "person_name": (info.name or "").strip(),
        "mobile": (info.phone or "").strip(),
        "email": (info.email or "").strip(),
        "address": (info.address or "").strip(),
    }


# 앞면 배경이 이 밝기 이상이면 흰 로고가 묻힌다. 그만큼 눌러서 대비를 확보한다.
_FRONT_BG_MAX_LUMA = 150.0


def _card_front_bg(logo_rgba: Image.Image) -> Tuple[int, int, int]:
    """명함 앞면 배경색 - 로고에 실제로 칠해진 대표색에서 만든다.

    설문 색(사용자가 고른 HEX)을 쓰던 때가 있었다. 색을 하나만 고른 경우에는
    force_single_color가 로고를 그 색으로 통일하므로 둘이 정확히 일치했지만,
    두 개 이상 고르면 강제가 걸리지 않아 로고 잉크와 설문 첫 색이 서로 다른
    파랑이 됐다 - 앞면 바탕과 뒷면 로고의 색이 미묘하게 어긋나 보였다
    (실측 확인됨). 눈에 보이는 것은 로고에 칠해진 색이므로 그쪽을 정본으로 삼는다.

    밝은 로고일 때 그대로 깔면 흰 로고가 묻히므로, 대비가 확보될 만큼만 누른다.
    """
    from app.services.business_card import _dominant_logo_color

    r, g, b = _dominant_logo_color(logo_rgba)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    if lum <= _FRONT_BG_MAX_LUMA:
        return (r, g, b)
    scale = _FRONT_BG_MAX_LUMA / max(lum, 1.0)
    return tuple(max(0, min(255, round(c * scale))) for c in (r, g, b))


def tint_solid(rgba: Image.Image, color: Tuple[int, int, int]) -> Image.Image:
    """알파는 그대로 두고 색만 한 가지로 덮는다.

    앞면은 브랜드 색 바탕에 로고를 흰색으로 얹는다(역상 로고). 원래 색 그대로
    올리면 바탕과 같은 계열이라 형태가 안 읽힌다.
    """
    rgba = rgba.convert("RGBA")
    solid = Image.new("RGBA", rgba.size, color + (255,))
    solid.putalpha(rgba.getchannel("A"))
    return solid


def _logo_already_has_brand_name(survey: dict, brand: str) -> bool:
    """합성된 로고 이미지가 브랜드명을 포함하고 있는가.

    /generate가 내보내는 로고는 심볼 스타일이 아닌 한 이름을 품고 있다. 판정을
    프롬프트·로고합성과 같은 함수로 맞춰, 세 곳이 서로 다른 답을 내지 않게 한다.
    """
    if not brand:
        return False
    from app.services.logo_composer import _wants_text_overlay
    from app.services.prompt_service import (
        _normalize_survey,
        model_draws_wordmark,
    )

    style_key = _normalize_survey(dict(survey)).get("style", "혼합형")
    return model_draws_wordmark(survey) or _wants_text_overlay(survey, style_key, brand)


def _business_card_inputs(logo: Image.Image, info: Optional[CardInfo], survey: dict):
    """명함 앞면과 뒷면을 만든다.

    앞면은 로고 대표색 바탕에 흰 로고(역상), 뒷면은 흰 바탕에 원래 색 로고다.
    앞면 배경을 설문 색에서 뽑던 때가 있었는데, 색을 두 개 이상 고르면 로고
    잉크와 설문 첫 색이 달라져 앞뒤 색이 어긋나 보였다(실측 확인됨). 눈에 보이는
    것은 로고에 칠해진 색이므로 그쪽을 정본으로 삼는다.

    info가 없으면(백엔드가 아직 card_info를 안 보내는 상태) 인적사항 영역이 비고
    브랜드 정보만 남는다. 레이아웃은 동일하므로 값이 채워지면 그대로 명함이 된다.
    """
    from app.services.business_card import CARD_BACK_BG

    # 배경색 추정에는 흰색을 남긴 상태를 쓰고(대표색 계산이 흔들리지 않도록),
    # 실제로 카드에 얹는 이미지는 흰 면을 비운 버전을 쓴다.
    logo_rgba = knockout_white(_logo_rgba(logo))
    back_bg = CARD_BACK_BG
    front_bg = _card_front_bg(logo_rgba)
    # 앞면은 브랜드 색 바탕 + 흰 로고(역상), 뒷면은 흰 바탕 + 원래 색 로고.
    logo_front = tint_solid(logo_rgba, (255, 255, 255))

    brand = _brand_name(survey) or (info.company if info and info.company else "")
    tagline = (survey.get("brand_direction") or survey.get("company_values_text") or "").strip()
    # 태그라인이 길면 카드에서 잘린다. 문장이 아니라 한 줄 문구가 들어갈 자리다.
    if len(tagline) > 40:
        tagline = ""

    # 로고 이미지에 이미 브랜드명이 들어 있으면 카드에 또 적지 않는다.
    # 모델이 워드마크를 그렸거나(영문) logo_composer가 폰트로 합성했거나(한글)
    # 어느 쪽이든 결과는 같다 - 로고 바로 밑에 같은 이름이 한 번 더 찍힌다
    # (실측 확인됨 - 앞뒷면 모두에서 발생).
    if _logo_already_has_brand_name(survey, brand):
        brand = ""
        tagline = ""

    return logo_front, logo_rgba, brand, tagline, _card_contact(info), front_bg, back_bg


def _compose_business_card(logo: Image.Image, info: Optional[CardInfo], survey: dict) -> Tuple[Image.Image, Image.Image]:
    from app.services.business_card import compose_card_back, compose_card_front

    logo_front, logo_rgba, brand, tagline, contact, front_bg, back_bg = _business_card_inputs(
        logo, info, survey
    )
    front = compose_card_front(
        logo_front, brand, tagline, front_bg, _CARD_FONT_BOLD, _CARD_FONT_REGULAR
    )
    back = compose_card_back(
        logo_rgba, brand, tagline, contact, back_bg,
        _CARD_FONT_BOLD, _CARD_FONT_REGULAR,
    )
    return front, back


# --------------------------------------------------------------------------- 제품 썸네일
# AI팀이 준비한 세 목업 중 top_left 한 장만 사용한다. 한 요청에서 세 템플릿을 모두
# 호출하면 지연시간과 비용이 세 배가 되므로, 현재 제품 썸네일 계약(images 한 장)에
# 맞춰 단일 편집 호출로 고정한다.
_PRODUCT_MOCKUP_TEMPLATE = "top_left"


def _generate_ai_product_mockup(
    size: Tuple[int, int], logo: Image.Image, product_name: Optional[str], survey: dict
) -> Image.Image:
    from app.services import product_mockup_ai_service

    brand_name = _brand_name(survey) or (product_name or "")
    image = product_mockup_ai_service.composite_logo_onto_mockup(
        logo,
        template=_PRODUCT_MOCKUP_TEMPLATE,
        brand_name=brand_name,
    )
    return _fit_cover(image.convert("RGB"), size)


def _fit_cover(img: Image.Image, size: Tuple[int, int]) -> Image.Image:
    """잘라내는 대신 빈틈없이 채우도록 리사이즈한다(가운데 크롭).

    AI가 돌려주는 이미지는 요청한 1:1 비율과 정확히 같은 픽셀 수가 아닐 수 있어,
    캔버스 규격(1000x1000)에 맞춰 여백 없이 덮는다.
    """
    W, H = size
    ratio = max(W / img.width, H / img.height)
    new_size = (max(1, round(img.width * ratio)), max(1, round(img.height * ratio)))
    resized = img.resize(new_size, Image.LANCZOS)
    left = (resized.width - W) // 2
    top = (resized.height - H) // 2
    return resized.crop((left, top, left + W, top + H))


def _sample_text_zone_color(img: Image.Image) -> Tuple[int, int, int]:
    """제품명·헤드라인이 얹히는 하단 영역의 평균색을 대비 판정용으로 돌려준다."""
    W, H = img.size
    region = np.asarray(img.convert("RGB").crop((0, int(H * 0.55), W, H)), dtype=np.float64)
    avg = region.reshape(-1, 3).mean(axis=0)
    return tuple(int(c) for c in avg)


def _draw_background(canvas: Image.Image, style: str, accent: tuple) -> tuple:
    """단색/그라데이션 배경을 그리고 그 위에 올릴 글자색 판단용 바탕색을 돌려준다.

    SOLID_LIGHT·SOFT_SHADOW 전용이다. 기본값(TONE_GRADIENT)은 이제 AI 제품 사진
    (_generate_ai_product_scene)을 먼저 쓰고, 그게 실패할 때만 이 함수의
    그라데이션으로 대체한다 — _compose_product_thumbnail 참고.
    """
    W, H = canvas.size
    d = ImageDraw.Draw(canvas)

    if style == "SOLID_LIGHT":
        # 아이보리 단색. 판매 채널에서 가장 무난하고 제품이 도드라진다.
        base = (250, 249, 246)
        d.rectangle([0, 0, W, H], fill=base)
        return base

    if style == "SOFT_SHADOW":
        # 밝은 바탕 + 하단에 은은한 그림자. 제품이 놓인 느낌을 준다.
        base = (252, 252, 253)
        d.rectangle([0, 0, W, H], fill=base)
        shadow = Image.new("L", (W, H), 0)
        sd = ImageDraw.Draw(shadow)
        sd.ellipse([int(W * 0.18), int(H * 0.60), int(W * 0.82), int(H * 0.78)], fill=70)
        canvas.paste(
            Image.new("RGB", (W, H), tuple(int(c * 0.55) for c in accent)),
            (0, 0),
            shadow.filter(ImageFilter.GaussianBlur(48)),
        )
        return base

    # TONE_GRADIENT — 강조색을 위에 옅게 깔고 아래로 밝아진다. 용기 합성이
    # 실패했을 때의 대체용이라 이 자리에 도달하는 일은 드물어야 한다.
    top = tuple(int(c * 0.34 + 255 * 0.66) for c in accent)
    bottom = (252, 252, 253)
    for y in range(H):
        t = y / (H - 1)
        d.line(
            [(0, y), (W, y)],
            fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)),
        )
    return bottom


def _text_area_ratio(before: Image.Image, after: Image.Image) -> float:
    """글자를 그리기 전후를 비교해 텍스트가 덮은 면적 비율을 구한다.

    폰트 메트릭으로 사각형 넓이를 재면 글자 사이 여백까지 포함되어 과대평가된다.
    실제로 픽셀이 바뀐 자리만 세는 편이 채널 심사 기준에 가깝다.
    """
    a = np.asarray(before.convert("RGB"), dtype=np.int16)
    b = np.asarray(after.convert("RGB"), dtype=np.int16)
    changed = (np.abs(a - b).max(axis=2) > 8)
    return float(changed.sum()) / float(changed.size)


def _compose_product_thumbnail(
    logo: Image.Image,
    product_name: Optional[str],
    survey: dict,
    category: Optional[str] = None,
    background_style: str = "TONE_GRADIENT",
    headline: Optional[str] = None,
) -> Tuple[Image.Image, float, Optional[str]]:
    """스마트스토어 규격(1000x1000) 제품 썸네일, 텍스트 면적 비율, AI 생성 실패 사유를 돌려준다."""
    W, H = KIT_SIZE["PRODUCT_THUMBNAIL"]
    accent = _pick_accent(survey)

    ai_error = None
    if background_style == "TONE_GRADIENT":
        # 기본값 — 실제 로고를 준비된 제품 목업 한 장에 AI로 합성한다. 호출이
        # 실패하면(키 미설정·네트워크 오류 등) 그라데이션 배경 + 중앙 로고로 대체한다.
        try:
            canvas = _generate_ai_product_mockup((W, H), logo, product_name, survey)
            base = _sample_text_zone_color(canvas)
        except Exception as e:
            ai_error = str(e)
            canvas = Image.new("RGB", (W, H))
            base = _draw_background(canvas, background_style, accent)
            logo_img = _fit(_trim(_logo_rgba(logo)), int(W * 0.54), int(H * 0.38))
            logo_cy = 0.36 if category else 0.32
            canvas.paste(
                logo_img,
                ((W - logo_img.width) // 2, int(H * logo_cy) - logo_img.height // 2),
                logo_img,
            )
    else:
        # SOLID_LIGHT·SOFT_SHADOW — AI 없이 실제 로고만 가운데 얹는 명시적 선택지.
        canvas = Image.new("RGB", (W, H))
        base = _draw_background(canvas, background_style, accent)
        logo_img = _fit(_trim(_logo_rgba(logo)), int(W * 0.54), int(H * 0.38))
        logo_cy = 0.36 if category else 0.32
        canvas.paste(
            logo_img,
            ((W - logo_img.width) // 2, int(H * logo_cy) - logo_img.height // 2),
            logo_img,
        )

    text_color = _readable_on(base)

    # 글자를 그리기 직전 상태를 떠둔다. 이후 면적 비율 계산의 기준이 된다.
    before = canvas.copy()
    d = ImageDraw.Draw(canvas)

    if category:
        label = CATEGORY_LABEL.get(category, "")
        if label:
            d.text(
                (W // 2, int(H * 0.06)), label,
                font=_resolve_font(30, weight="regular"), fill=accent, anchor="ma",
            )

    name = (product_name or _brand_name(survey) or "").strip()
    if name:
        d.text(
            (W // 2, int(H * 0.66)), name[:28],
            font=_resolve_font(46, weight="bold"), fill=text_color, anchor="ma",
        )

    if headline:
        d.text(
            (W // 2, int(H * 0.79)), headline.strip()[:HEADLINE_MAX_CHARS],
            font=_resolve_font(34, weight="regular"), fill=text_color, anchor="ma",
        )

    return canvas, _text_area_ratio(before, canvas), ai_error


# --------------------------------------------------------------------------- 진입점
def _to_base64(img: Image.Image) -> str:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def create_brand_kit(req: BrandKitRequest) -> BrandKitResponse:
    started = time.monotonic()
    kit_type = req.canonical_kit_type
    logo = _decode_logo(req.logo_image_base64)
    warnings: list[str] = []

    if kit_type == "BUSINESS_CARD":
        # 명함은 앞/뒷면 두 장이다. images[]에 순서대로 담고, 최상위 imageBase64에는
        # 앞면을 복제한다 — 백엔드가 최상위 한 장만 읽고 있어 수정 없이 붙는다.
        front, back = _compose_business_card(logo, req.card_info, req.survey)
        images = [front, back]
        from app.services.business_card_print import compose_business_card_svgs, svg_to_pdf

        print_inputs = _business_card_inputs(logo, req.card_info, req.survey)
        svg_values = list(compose_business_card_svgs(
            req.logo_svg, *print_inputs, _CARD_FONT_BOLD, _CARD_FONT_REGULAR
        ))
        pdf_values = [svg_to_pdf(svg, images[index]) for index, svg in enumerate(svg_values)]
        if req.card_info is None:
            warnings.append(
                "card_info가 없어 인적사항 없이 브랜드 정보만 넣었습니다. "
                "이름·직함·연락처를 보내면 명함 뒷면이 완성됩니다."
            )
    else:
        thumb, text_ratio, ai_error = _compose_product_thumbnail(
            logo, req.product_name, req.survey,
            category=req.category,
            background_style=req.background_style,
            headline=req.headline,
        )
        images = [thumb]
        svg_values = []
        pdf_values = []
        # 판매 채널 가이드라인 자동 검수. 업로드 후 반려되어 재제작하는 비용을
        # 생성 단계에서 미리 막는다.
        if text_ratio > TEXT_AREA_LIMIT:
            warnings.append(
                f"텍스트가 이미지의 {text_ratio:.0%}를 차지합니다 "
                f"(권장 {TEXT_AREA_LIMIT:.0%} 이하). 카피를 줄이면 채널 심사에 안전합니다."
            )
        if ai_error:
            warnings.append(f"AI 제품 사진 생성 실패 — 톤 기반 그라데이션으로 대체했습니다: {ai_error}")

    encoded = [_to_base64(img) for img in images]
    return BrandKitResponse(
        kitType=kit_type,
        imageBase64=encoded[0],
        images=[
            BrandKitImage(
                imageBase64=b64,
                width=img.width,
                height=img.height,
                svgBase64=base64.b64encode(svg_values[index].encode("utf-8")).decode("ascii")
                if index < len(svg_values) else None,
                pdfBase64=base64.b64encode(pdf_values[index]).decode("ascii")
                if index < len(pdf_values) else None,
            )
            for index, (b64, img) in enumerate(zip(encoded, images))
        ],
        preliminary=bool(warnings),
        warnings=warnings,
        elapsedMs=int((time.monotonic() - started) * 1000),
    )
