"""BusinessCardRequest(백엔드에서 받은 실제 값)를 business_card.py 함수에 그대로
넘겨 명함을 조립하는 서비스.

색상, 폰트 등 어떤 값도 고정되어 있지 않다. 요청값을 그대로 파싱해
business_card.compose_card_front/back에 넘길 뿐이다.
"""
import base64
from io import BytesIO
from pathlib import Path
from typing import Optional

from PIL import Image

from app.services.business_card import compose_card_front, compose_card_back
from app.services.business_card_showcase import compose_card_showcase

_FONT_DIR = Path(__file__).resolve().parent.parent / "fonts"
_FONT_PATHS = {
    "modern_sans": {
        "bold": str(_FONT_DIR / "modern_sans" / "bold" / "Pretendard-Bold.ttf"),
        "regular": str(_FONT_DIR / "modern_sans" / "regular" / "Pretendard-Regular.ttf"),
    },
    "elegant_serif": {
        "bold": str(_FONT_DIR / "elegant_serif" / "bold" / "NanumMyeongjo-Bold.ttf"),
        "regular": str(_FONT_DIR / "elegant_serif" / "regular" / "NanumMyeongjo-Regular.ttf"),
    },
}


def _resolve_font_paths(style: Optional[str]):
    style = style if style in _FONT_PATHS else "modern_sans"
    return _FONT_PATHS[style]["bold"], _FONT_PATHS[style]["regular"]


def _base64_to_image(b64_str: str) -> Image.Image:
    return Image.open(BytesIO(base64.b64decode(b64_str))).convert("RGBA")


def _image_to_base64(img: Image.Image) -> str:
    buf = BytesIO()
    img.convert("RGB").save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _parse_rgb(rgb_str: str) -> tuple:
    return tuple(int(v) for v in rgb_str.split(","))


def _showcase_backdrop(front_rgb: tuple) -> tuple:
    """쇼케이스 대각선 배경 두 톤을 카드 앞면 색에서 만든다.

    compose_card_showcase의 기본값(짙은 초록 + 회색)은 브랜드 색과 무관해서,
    카드가 배경과 따로 노는 것처럼 보였다(실측 확인됨 — 남색 카드 + 초록/회색
    배경). 앞면 배경색을 그대로 어둡게/밝게 눌러써서 카드와 한 색 계열로
    묶는다.
    """
    r, g, b = front_rgb
    darker = tuple(max(0, round(c * 0.72)) for c in (r, g, b))
    lighter = tuple(min(255, round(c * 0.55 + 255 * 0.45)) for c in (r, g, b))
    return darker, lighter


class BusinessCardService:
    @staticmethod
    def generate(req) -> dict:
        """req: BusinessCardRequest. 반환값은 BusinessCardResponse에 그대로 매핑 가능한 dict."""
        logo = _base64_to_image(req.logo_image_base64)
        font_bold, font_regular = _resolve_font_paths(req.font_style)

        front = compose_card_front(
            logo, req.brand_name, req.tagline,
            bg_color=_parse_rgb(req.bg_front),
            font_path_bold=font_bold,
            font_path_regular=font_regular,
        )
        back = compose_card_back(
            logo, req.brand_name, req.tagline,
            contact={
                "title": req.title,
                "person_name": req.person_name,
                "mobile": req.phone,
                "email": req.email,
                "address": req.address,
            },
            bg_color=_parse_rgb(req.bg_back),
            font_path_bold=font_bold,
            font_path_regular=font_regular,
        )

        result = {
            "front_image_base64": _image_to_base64(front),
            "back_image_base64": _image_to_base64(back),
            "showcase_image_base64": None,
        }
        if req.include_showcase:
            bg_left, bg_right = _showcase_backdrop(_parse_rgb(req.bg_front))
            showcase = compose_card_showcase(front, back, bg_color_left=bg_left, bg_color_right=bg_right)
            result["showcase_image_base64"] = _image_to_base64(showcase)
        return result
