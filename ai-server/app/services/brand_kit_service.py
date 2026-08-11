"""브랜드킷(F14) 합성 서비스.

설계 전제 — 로고를 이미지 생성 모델에 통째로 넣지 않는다.
현재 FLUX 호출부(flux_service._call_flux_klein)는 prompt/width/height/seed/steps만
보내는 text-to-image 경로이고, 설령 image-to-image가 열려도 디퓨전 모델은 입력 로고를
그대로 재현하지 못한다. 브랜드 아이덴티티 산출물에서 사용자의 로고가 변형돼 나오면
기능 자체가 무의미해지므로, 배경만 생성하고 로고는 PIL로 정확히 얹는다.
이 방침은 기획서 (7) 수행방법의 'CI 명함: 정보 정확도 확보를 위해 이미지 생성 모델
미사용' 항목과 동일하다.

현재 구현 상태:
    BUSINESS_CARD      템플릿 합성으로 최종 품질까지 구현 (외부 API 불필요)
    PRODUCT_THUMBNAIL  톤 기반 그라데이션 배경 + 로고 합성까지 구현.
                       FLUX 연출 배경 생성은 미구현이며 응답에 preliminary=True로 표시한다.
"""
import base64
import binascii
import re
import time
from io import BytesIO
from typing import Optional, Tuple

import numpy as np
from PIL import Image, ImageDraw

from app.core.exceptions import (
    BrandKitInvalidImage,
    BrandKitMissingCardInfo,
)
from app.schemas.brand_kit import (
    KIT_SIZE,
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
def _compose_business_card(logo: Image.Image, info: CardInfo, survey: dict) -> Image.Image:
    """좌: 로고 / 우: 인적사항 2단 구성.

    로고를 위, 정보를 아래에 쌓으면 명함 가로폭(1063px) 우측 절반이 통째로 비어
    허전해진다(실측 확인됨). 좌우로 나눠 양쪽 무게를 맞춘다.
    """
    W, H = KIT_SIZE["BUSINESS_CARD"]
    accent = _pick_accent(survey)
    tone = _tone(survey)

    card = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(card)

    # 좌측 세로 강조 바 — 로고 색을 카드에 계승시키는 최소 장치
    d.rectangle([0, 0, 14, H], fill=accent)

    # --- 좌측: 로고 (세로 중앙)
    left_x, left_w = 84, 320
    logo_img = _fit(_trim(_logo_rgba(logo)), left_w, int(H * 0.62))
    card.paste(
        logo_img,
        (left_x + (left_w - logo_img.width) // 2, (H - logo_img.height) // 2),
        logo_img,
    )

    # --- 세로 구분선
    div_x = left_x + left_w + 56
    d.line([div_x, 96, div_x, H - 96], fill=(228, 232, 239), width=2)

    # --- 우측: 인적사항 (블록 전체를 세로 중앙에 맞춘다)
    tx = div_x + 56
    f_name = _resolve_font(44, weight="bold")
    f_title = _resolve_font(24, weight="regular")
    f_body = _resolve_font(22, weight="regular")

    company = (info.company or "").strip()
    lines = [t.strip() for t in (info.phone, info.email, info.address) if t and t.strip()]

    block_h = 56 + (34 if info.title else 0) + (30 if company else 0) + len(lines) * 32
    y = (H - block_h) // 2

    d.text((tx, y), info.name, font=f_name, fill=(24, 28, 36))
    y += 56
    if info.title:
        d.text((tx, y), info.title, font=f_title, fill=accent)
        y += 34
    if company:
        d.text((tx, y), company, font=f_body, fill=(120, 128, 142))
        y += 30
    y += 12
    for text in lines:
        d.text((tx, y), text, font=f_body, fill=(96, 104, 118))
        y += 32

    _ = tone  # 폰트 톤 반영은 후속 작업(현재는 기본 고딕 고정)
    return card


# --------------------------------------------------------------------------- 제품 썸네일
def _compose_product_thumbnail(
    logo: Image.Image, product_name: Optional[str], survey: dict
) -> Image.Image:
    W, H = KIT_SIZE["PRODUCT_THUMBNAIL"]
    accent = _pick_accent(survey)

    # 강조색을 위쪽에 옅게 깔고 아래로 갈수록 밝아지는 세로 그라데이션.
    # FLUX 연출 배경이 붙기 전까지의 임시 바탕이다.
    canvas = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(canvas)
    top = tuple(int(c * 0.34 + 255 * 0.66) for c in accent)
    bottom = (252, 252, 253)
    for y in range(H):
        t = y / (H - 1)
        d.line(
            [(0, y), (W, y)],
            fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)),
        )

    logo_img = _fit(_trim(_logo_rgba(logo)), int(W * 0.56), int(H * 0.42))
    canvas.paste(logo_img, ((W - logo_img.width) // 2, int(H * 0.30) - logo_img.height // 2), logo_img)

    name = (product_name or _brand_name(survey) or "").strip()
    if name:
        f = _resolve_font(46, weight="bold")
        d.text((W // 2, int(H * 0.70)), name[:28], font=f, fill=_readable_on(bottom), anchor="ma")

    return canvas


# --------------------------------------------------------------------------- 진입점
def _to_base64(img: Image.Image) -> str:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def create_brand_kit(req: BrandKitRequest) -> BrandKitResponse:
    started = time.monotonic()
    kit_type = req.canonical_kit_type

    if kit_type == "BUSINESS_CARD" and req.card_info is None:
        raise BrandKitMissingCardInfo()

    logo = _decode_logo(req.logo_image_base64)

    if kit_type == "BUSINESS_CARD":
        image = _compose_business_card(logo, req.card_info, req.survey)
        preliminary = False
    else:
        image = _compose_product_thumbnail(logo, req.product_name, req.survey)
        preliminary = True  # FLUX 연출 배경 미적용

    return BrandKitResponse(
        kitType=kit_type,
        images=[
            BrandKitImage(
                imageBase64=_to_base64(image),
                width=image.width,
                height=image.height,
            )
        ],
        preliminary=preliminary,
        elapsedMs=int((time.monotonic() - started) * 1000),
    )
