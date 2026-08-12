"""명함 앞/뒷면 이미지를 받아, 화면에 보여주기 좋은 "쇼케이스" 연출 이미지로 만드는 모듈.

business_card.py가 만드는 건 인쇄용 평면 앞/뒷면(정면, 기울어짐 없음)이고, 이 모듈은
그 결과물을 받아서 살짝 기울이고 그림자를 넣어 입체감을 준 다음, 두 톤 배경 위에
자연스럽게 겹쳐 배치한다. 카드 내용(로고·텍스트) 자체는 건드리지 않고 오직 "어떻게
보여줄지"만 다루므로, business_card.py의 결과물을 그대로 입력으로 받는다.
"""

from typing import Optional, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def _darken(rgb: Tuple[int, int, int], factor: float) -> Tuple[int, int, int]:
    return tuple(round(c * factor) for c in rgb)


def _mute(
    rgb: Tuple[int, int, int], neutral: Tuple[int, int, int], ratio: float
) -> Tuple[int, int, int]:
    return tuple(round(c * (1 - ratio) + n * ratio) for c, n in zip(rgb, neutral))


def _card_bg_color(card_img: Image.Image) -> Tuple[int, int, int]:
    """카드 이미지의 배경색을 알아낸다. business_card.compose_card_front/back는
    항상 지정된 bg_color로 캔버스를 통째로 채운 뒤 그 위에 로고/텍스트를 그리므로,
    로고·텍스트가 닿지 않는 좌상단 모서리 픽셀이 곧 배경색이다."""
    return card_img.convert("RGB").getpixel((0, 0))


def _derive_showcase_colors(
    front_img: Image.Image, back_img: Image.Image
) -> Tuple[Tuple[int, int, int], Tuple[int, int, int]]:
    """쇼케이스 배경색을 카드 자체의 배경색에서 자동으로 유도한다.

    호출부가 bg_color_left/right를 직접 안 넘겼을 때만 쓰인다. 카드 색과 무관한
    고정값(예전 기본값: 그린/그레이)을 쓰면 프롬프트에서 명함 색을 바꿔도 쇼케이스
    배경은 그대로라 화면이 어긋나 보이는 문제가 있었다(실측 확인됨) — 그래서
    앞면/뒷면 배경색을 그대로 물려받되, 왼쪽(앞면 쪽)은 살짝 어둡게 눌러 카드와
    구분되게 하고, 오른쪽(뒷면 쪽)은 무채색 쪽으로 낮춰 은은한 표면 톤으로 만든다.
    """
    front_bg = _card_bg_color(front_img)
    back_bg = _card_bg_color(back_img)
    bg_left = _darken(front_bg, 0.85)
    bg_right = _mute(back_bg, (150, 140, 145), 0.55)
    return bg_left, bg_right


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


def compose_card_showcase(
    front_img: Image.Image,
    back_img: Image.Image,
    canvas_size: Tuple[int, int] = (760, 760),
    bg_color_left: Optional[Tuple[int, int, int]] = None,
    bg_color_right: Optional[Tuple[int, int, int]] = None,
    card_width: int = 430,
    angle_deg: float = -9.0,
    overlap_ratio: float = 0.5,
) -> Image.Image:
    """명함 앞면(위)과 뒷면(아래, 겹침)을 기울여서 두 톤 배경 위에 연출한 쇼케이스 이미지.

    front_img/back_img: business_card.compose_card_front/back가 만든 평면 이미지.
    bg_color_left/right: 생략하면(None) front_img/back_img의 실제 배경색에서 자동
        유도한다(_derive_showcase_colors) — 명함 배경색이 바뀌면 쇼케이스 배경도
        같이 바뀌게 하기 위함이다. 특정 톤을 강제로 고정하고 싶을 때만 직접 넘긴다.
    overlap_ratio: 뒷면이 앞면과 얼마나 겹치게 내려올지(카드 높이 대비 비율).
    """
    if bg_color_left is None or bg_color_right is None:
        derived_left, derived_right = _derive_showcase_colors(front_img, back_img)
        bg_color_left = bg_color_left or derived_left
        bg_color_right = bg_color_right or derived_right

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