"""Recraft로 명함 디자인 샘플(앞/뒷면)을 만드는 서비스.

[중요] scripts/try_recraft_card_sample.py(실험용 CLI 스크립트)와 프롬프트 조립 로직
(_rgb_to_hex, build_front_prompt, build_back_prompt)은 동일하게 유지한다 — CLI로
확인한 프롬프트와 실제 API가 받는 프롬프트가 어긋나지 않게 하기 위함이다. 다만
service는 logo_gen_service._call_image_api를 그대로 재사용한다 — 이미 있는 API
호출 코드(재시도, 에러 처리, seed 처리 포함)를 중복해서 만들 이유가 없다.

이건 텍스트가 AI로 그려지는 "샘플/디자인 참고용"이다. 실제 배포용 최종 명함은
반드시 business_card.py(코드 렌더링, 텍스트 100% 정확)로 만들어야 한다.
"""

import base64
from io import BytesIO

from PIL import Image

from app.services.logo_gen_service import _call_image_api


def _rgb_to_hex(rgb_str: str) -> str:
    r, g, b = (int(v) for v in rgb_str.split(","))
    return f"#{r:02X}{g:02X}{b:02X}"


def _composite_on_bg(img: Image.Image, rgb_str: str) -> Image.Image:
    """벡터 모델(recraft-*-vector) 응답은 logo_gen_service._call_image_api가
    배경 path를 자동으로 지운 투명 배경으로 온다(로고 아이콘 용도로는 맞는
    동작). 하지만 명함 샘플은 배경색 자체가 디자인의 일부이므로, 요청받은
    bg_front/bg_back 색으로 다시 채워 넣는다 — AI가 배경색을 정확히 못 맞춰도
    항상 요청한 색 그대로 나오게 하는 효과도 있다.
    """
    r, g, b = (int(v) for v in rgb_str.split(","))
    bg = Image.new("RGB", img.size, (r, g, b))
    bg.paste(img.convert("RGBA"), (0, 0), img.convert("RGBA"))
    return bg


def build_front_prompt(brand_name: str, tagline: str, bg_front: str) -> str:
    bg_hex = _rgb_to_hex(bg_front)
    return (
        f"Design the front side of a premium business card for a beauty brand "
        f"called \"{brand_name}\". The background is a solid color {bg_hex}. "
        f"The brand name \"{brand_name.upper()}\" is centered in clean, elegant "
        f"white uppercase lettering, with the tagline \"{tagline}\" in smaller "
        f"white text directly below it. Leave generous white space around the "
        f"text. The overall style is modern, minimal, and trustworthy, suitable "
        f"for a professional beauty company. Rendered as a flat, front-facing "
        f"photo of a single business card, no hands, no other objects in the frame."
    )


def build_back_prompt(
    brand_name: str, title: str, person_name: str, mobile: str, email: str,
    address: str, bg_back: str,
) -> str:
    bg_hex = _rgb_to_hex(bg_back)
    return (
        f"Design the back side of a premium business card for a beauty brand "
        f"called \"{brand_name}\". The background is a solid color {bg_hex}. In "
        f"the top-left corner, show the brand name \"{brand_name.upper()}\" in "
        f"small dark text. On the right side of the card, display in dark text, "
        f"right-aligned and stacked vertically: the title \"{title}\" next to "
        f"the name \"{person_name}\" in bold, followed below by a thin "
        f"horizontal divider line, then three lines of contact information: "
        f"\"Mobile.  {mobile}\", \"E-mail.  {email}\", and \"Address.  {address}\". "
        f"Keep the layout clean, minimal, and well-balanced with clear spacing "
        f"between each line. Rendered as a flat, front-facing photo of a single "
        f"business card, no hands, no other objects in the frame."
    )


def _image_to_base64(img: Image.Image) -> str:
    buf = BytesIO()
    img.convert("RGB").save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


class BusinessCardSampleService:
    @staticmethod
    def generate_sample(req) -> dict:
        """req: CardSampleRequest. 반환값은 {"front_image_base64": ..., "back_image_base64": ...}."""
        front_prompt = build_front_prompt(req.brand_name, req.tagline, req.bg_front)
        back_prompt = build_back_prompt(
            req.brand_name, req.title, req.person_name, req.mobile,
            req.email, req.address, req.bg_back,
        )
        front_img, _ = _call_image_api(front_prompt, seed=1001)
        back_img, _ = _call_image_api(back_prompt, seed=1002)
        front_img = _composite_on_bg(front_img, req.bg_front)
        back_img = _composite_on_bg(back_img, req.bg_back)
        return {
            "front_image_base64": _image_to_base64(front_img),
            "back_image_base64": _image_to_base64(back_img),
        }
