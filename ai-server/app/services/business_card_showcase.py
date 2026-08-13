"""명함 앞/뒷면 이미지를 받아, 화면에 보여주기 좋은 "쇼케이스" 연출 이미지로 만드는 모듈.

business_card.py가 만드는 건 인쇄용 평면 앞/뒷면(정면, 기울어짐 없음)이고, 이 모듈은
그 결과물을 받아서 살짝 기울이고 그림자를 넣어 입체감을 준 다음, 두 톤 배경 위에
자연스럽게 겹쳐 배치한다. 카드 내용(로고·텍스트) 자체는 건드리지 않고 오직 "어떻게
보여줄지"만 다루므로, business_card.py의 결과물을 그대로 입력으로 받는다.
"""

from typing import Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance


def _make_diagonal_background(
    size: Tuple[int, int],
    color_left: Tuple[int, int, int],
    color_right: Tuple[int, int, int],
    split_ratio: float = 0.5,
    texture_strength: float = 10.0,
) -> Image.Image:
    """대각선으로 두 색을 가른 배경에 미세한 노이즈 텍스처(원단/종이 질감)를 얹는다."""
    w, h = size
    bg = Image.new("RGB", size, color_left)
    draw = ImageDraw.Draw(bg)
    split_x = w * split_ratio
    slant = w * 0.18
    draw.polygon(
        [(split_x + slant, 0), (w, 0), (w, h), (split_x - slant, h)],
        fill=color_right,
    )

    noise = (np.random.randn(h, w, 1) * texture_strength).astype("int16")
    arr = np.asarray(bg).astype("int16") + noise
    arr = arr.clip(0, 255).astype("uint8")
    bg = Image.fromarray(arr, mode="RGB")
    return bg.filter(ImageFilter.GaussianBlur(0.5))


def _add_drop_shadow(
    card_rgba: Image.Image, blur_radius: int = 22, opacity: int = 120
) -> Tuple[Image.Image, Tuple[int, int]]:
    """카드의 알파(투명) 모양을 그대로 본떠 부드러운 그림자를 만든다.
    반환값은 (그림자 이미지, 그 위에 카드를 얹을 때의 상대 오프셋)."""
    pad = blur_radius * 2
    w, h = card_rgba.size
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    alpha = card_rgba.split()[-1]
    black = Image.new("RGBA", card_rgba.size, (0, 0, 0, opacity))
    black.putalpha(alpha)
    canvas.paste(black, (pad, pad), black)
    shadow = canvas.filter(ImageFilter.GaussianBlur(blur_radius))
    return shadow, (pad, pad)


def _prepare_tilted_card(card_img: Image.Image, target_width: int, angle_deg: float):
    """카드를 목표 폭에 맞게 리사이즈하고, 지정한 각도로 회전시킨 뒤 그림자를 만든다."""
    card = card_img.convert("RGBA")
    ratio = target_width / card.width
    card = card.resize((target_width, round(card.height * ratio)), Image.LANCZOS)
    rotated = card.rotate(angle_deg, expand=True, resample=Image.BICUBIC)
    shadow, card_offset_in_shadow = _add_drop_shadow(rotated)
    return rotated, shadow, card_offset_in_shadow


def _add_stack_effect(
    card_rgba: Image.Image, layers: int = 4, offset_step: int = 4, darken_step: float = 0.05
) -> Tuple[Image.Image, Tuple[int, int]]:
    """카드 뒤에 살짝 어긋나게 여러 겹을 겹쳐서, 카드 여러 장이 쌓인 듯한 두께감을 만든다.
    각 레이어를 아주 조금씩 더 어둡게 해서 실제 종이 여러 장이 겹친 그림자 느낌을 낸다.
    반환값은 (스택 이미지, 원본 카드가 그 안에서 놓일 오프셋)."""
    w, h = card_rgba.size
    pad = offset_step * layers
    canvas = Image.new("RGBA", (w + pad, h + pad), (0, 0, 0, 0))
    alpha = card_rgba.split()[-1]

    for i in range(layers, 0, -1):
        brightness = max(1.0 - darken_step * i, 0.5)
        layer_rgb = ImageEnhance.Brightness(card_rgba.convert("RGB")).enhance(brightness)
        layer = layer_rgb.convert("RGBA")
        layer.putalpha(alpha)
        offset = (pad - i * offset_step, pad - i * offset_step)
        canvas.alpha_composite(layer, offset)

    canvas.alpha_composite(card_rgba, (pad, pad))
    return canvas, (pad, pad)


def compose_card_showcase_v2(
    front_img: Image.Image,
    back_img: Image.Image,
    canvas_size: Tuple[int, int] = (900, 620),
    bg_color: Tuple[int, int, int] = (150, 150, 150),
    front_width: int = 560,
    back_width: int = 420,
    front_angle_deg: float = -13.0,
    back_angle_deg: float = 12.0,
    stack_effect: bool = True,
) -> Image.Image:
    """참고 레퍼런스 스타일: 단색 배경, 앞면은 크게 전경(좌하단)에, 뒷면은 작게
    배경(우상단)에 배치해 원근감을 준다. 뒷면에는 카드 여러 장이 쌓인 듯한 스택
    효과를 적용해 "명함 뭉치" 느낌을 낸다.

    compose_card_showcase(기존, 대각선 두 톤 배경 + 앞뒤 겹침 구도)와는 별개의
    연출 스타일이다. 어느 쪽을 쓸지는 호출부가 고르면 된다.
    """
    bg = Image.new("RGB", canvas_size, bg_color).convert("RGBA")
    canvas = bg.copy()

    # 뒷면(작게, 배경) 먼저 그린다 — 앞면이 그 위에 겹쳐 보이도록.
    back_rot, back_shadow, back_off = _prepare_tilted_card(back_img, back_width, back_angle_deg)
    if stack_effect:
        back_rot, stack_off = _add_stack_effect(back_rot)
        # 그림자도 스택 두께만큼 함께 커진 것으로 다시 계산 (근사치로 충분)
        back_shadow, back_off = _add_drop_shadow(back_rot)
    back_x = canvas_size[0] - back_rot.width - round(canvas_size[0] * 0.06)
    back_y = round(canvas_size[1] * 0.06)

    canvas.alpha_composite(back_shadow, (back_x - back_off[0], back_y - back_off[1]))
    canvas.alpha_composite(back_rot, (back_x, back_y))

    # 앞면(크게, 전경)을 그 위에 겹쳐 그린다.
    front_rot, front_shadow, front_off = _prepare_tilted_card(front_img, front_width, front_angle_deg)
    front_x = round(canvas_size[0] * 0.04)
    front_y = canvas_size[1] - front_rot.height - round(canvas_size[1] * 0.05)

    canvas.alpha_composite(front_shadow, (front_x - front_off[0], front_y - front_off[1]))
    canvas.alpha_composite(front_rot, (front_x, front_y))

    return canvas.convert("RGB")


def compose_card_showcase(
    front_img: Image.Image,
    back_img: Image.Image,
    canvas_size: Tuple[int, int] = (760, 760),
    bg_color_left: Tuple[int, int, int] = (58, 98, 84),
    bg_color_right: Tuple[int, int, int] = (150, 150, 148),
    card_width: int = 430,
    angle_deg: float = -9.0,
    overlap_ratio: float = 0.5,
) -> Image.Image:
    """명함 앞면(위)과 뒷면(아래, 겹침)을 기울여서 두 톤 배경 위에 연출한 쇼케이스 이미지.

    front_img/back_img: business_card.compose_card_front/back가 만든 평면 이미지.
    overlap_ratio: 뒷면이 앞면과 얼마나 겹치게 내려올지(카드 높이 대비 비율).
    """
    bg = _make_diagonal_background(canvas_size, bg_color_left, bg_color_right)
    canvas = bg.convert("RGBA")

    front_rot, front_shadow, front_off = _prepare_tilted_card(front_img, card_width, angle_deg)
    back_rot, back_shadow, back_off = _prepare_tilted_card(back_img, card_width, angle_deg)

    front_x = (canvas_size[0] - front_rot.width) // 2 - round(card_width * 0.06)
    front_y = round(canvas_size[1] * 0.16)
    back_x = front_x + round(card_width * 0.10)
    back_y = front_y + round(front_rot.height * overlap_ratio)

    canvas.alpha_composite(front_shadow, (front_x - front_off[0], front_y - front_off[1]))
    canvas.alpha_composite(back_shadow, (back_x - back_off[0], back_y - back_off[1]))
    canvas.alpha_composite(front_rot, (front_x, front_y))
    canvas.alpha_composite(back_rot, (back_x, back_y))

    return canvas.convert("RGB")