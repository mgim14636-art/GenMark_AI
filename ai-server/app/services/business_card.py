from dataclasses import dataclass
from typing import Optional, Tuple
from PIL import Image, ImageDraw, ImageFont

@dataclass
class CardLayout:
    width: int = 1050
    height: int = 600
    logo_box_front: Tuple[int, int, int, int] = (400, 110, 650, 300)
    brand_name_center: Tuple[int, int] = (525, 335)
    tagline_center: Tuple[int, int] = (525, 372)
    logo_box_back: Tuple[int, int, int, int] = (60, 55, 175, 155)
    brand_name_pos_back: Tuple[int, int] = (195, 75)
    tagline_pos_back: Tuple[int, int] = (195, 112)
    name_right_edge: Tuple[int, int] = (960, 275)
    divider_y: int = 320
    contact_start_y: int = 350
    contact_right_edge_x: int = 960
    contact_line_gap: int = 34

def _luma(rgb: tuple) -> float:
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]

def _auto_text_color(bg_rgb: tuple) -> tuple:
    return (245, 245, 240) if _luma(bg_rgb) < 128 else (25, 28, 24)

def _dominant_logo_color(logo: Image.Image) -> tuple:
    """로고의 실제 도형 색 중 가장 많이 쓰인 색을 뽑는다. 거의 흰색/검정(배경·
    아웃라인 극단값)은 제외해서 로고의 "본색(hue)"이 대표값으로 잡히게 한다."""
    rgba = logo.convert("RGBA")
    small = rgba.resize((64, 64))
    counts: dict = {}
    for r, g, b, a in small.getdata():
        if a < 128:
            continue
        if r > 235 and g > 235 and b > 235:
            continue
        if r < 20 and g < 20 and b < 20:
            continue
        key = (r, g, b)
        counts[key] = counts.get(key, 0) + 1
    if not counts:
        for r, g, b, a in small.getdata():
            if a >= 128:
                counts[(r, g, b)] = counts.get((r, g, b), 0) + 1
    if not counts:
        return (40, 40, 40)
    return max(counts.items(), key=lambda kv: kv[1])[0]

def derive_card_bg_colors(logo: Image.Image) -> Tuple[tuple, tuple]:
    """로고 색상에서 명함 앞/뒷면 배경색을 자동으로 유도한다.

    호출부가 bg_color를 직접 지정하지 않았을 때 쓰는 기본값이다. 명함 배경이
    로고와 무관한 고정색(예전 기본값)이면 로고 색을 바꿔도 명함은 안 어울리는
    문제가 있었다(실측 확인됨) — 그래서 로고의 대표색(_dominant_logo_color)에서
    앞면(로고색을 어둡게 눌러 흰 텍스트가 선명한 톤)과 뒷면(같은 색조를 아주
    밝게 틴트해 연락처가 잘 읽히는 표면톤)을 함께 유도한다.
    """
    r, g, b = _dominant_logo_color(logo)
    front = tuple(round(c * 0.55) for c in (r, g, b))
    if _luma(front) < 25:
        front = tuple(round(c * 0.55 + 15) for c in (r, g, b))
    neutral = (245, 244, 240)
    back = tuple(round(c * 0.12 + n * 0.88) for c, n in zip((r, g, b), neutral))
    return front, back

def _resize_to_box(img: Image.Image, box: Tuple[int, int, int, int]) -> Tuple[Image.Image, Tuple[int, int]]:
    bx0, by0, bx1, by1 = box
    bw, bh = (bx1 - bx0, by1 - by0)
    ratio = img.width / img.height
    if ratio > bw / bh:
        new_w, new_h = (bw, max(round(bw / ratio), 1))
    else:
        new_h, new_w = (bh, max(round(bh * ratio), 1))
    resized = img.convert('RGBA').resize((new_w, new_h), Image.LANCZOS)
    x = bx0 + (bw - resized.width) // 2
    y = by0 + (bh - resized.height) // 2
    return (resized, (x, y))

def _draw_centered(draw: ImageDraw.ImageDraw, center: Tuple[int, int], text: str, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = (bbox[2] - bbox[0], bbox[3] - bbox[1])
    x = center[0] - w / 2 - bbox[0]
    y = center[1] - h / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=fill)

def _draw_right_aligned(draw: ImageDraw.ImageDraw, right_top: Tuple[int, int], text: str, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    x = right_top[0] - w - bbox[0]
    draw.text((x, right_top[1]), text, font=font, fill=fill)

def compose_card_front(logo: Image.Image, brand_name: str, tagline: str, bg_color: tuple, font_path_bold: Optional[str], font_path_regular: Optional[str], layout: CardLayout=CardLayout()) -> Image.Image:
    card = Image.new('RGB', (layout.width, layout.height), bg_color)
    draw = ImageDraw.Draw(card)
    text_color = _auto_text_color(bg_color)
    logo_resized, pos = _resize_to_box(logo, layout.logo_box_front)
    card.paste(logo_resized, pos, logo_resized)
    name_font = ImageFont.truetype(font_path_bold, 40) if font_path_bold else ImageFont.load_default()
    _draw_centered(draw, layout.brand_name_center, brand_name, name_font, text_color)
    if tagline:
        tag_font = ImageFont.truetype(font_path_regular, 18) if font_path_regular else ImageFont.load_default()
        _draw_centered(draw, layout.tagline_center, tagline, tag_font, text_color)
    return card

def compose_card_back(logo: Image.Image, brand_name: str, tagline: str, contact: dict, bg_color: tuple, font_path_bold: Optional[str], font_path_regular: Optional[str], layout: CardLayout=CardLayout()) -> Image.Image:
    card = Image.new('RGB', (layout.width, layout.height), bg_color)
    draw = ImageDraw.Draw(card)
    text_color = _auto_text_color(bg_color)
    muted_color = tuple((max(0, min(255, c + (30 if _luma(bg_color) < 128 else -60))) for c in text_color))
    logo_resized, pos = _resize_to_box(logo, layout.logo_box_back)
    card.paste(logo_resized, pos, logo_resized)
    brand_font = ImageFont.truetype(font_path_bold, 26) if font_path_bold else ImageFont.load_default()
    draw.text(layout.brand_name_pos_back, brand_name, font=brand_font, fill=text_color)
    if tagline:
        tag_font = ImageFont.truetype(font_path_regular, 13) if font_path_regular else ImageFont.load_default()
        draw.text(layout.tagline_pos_back, tagline, font=tag_font, fill=text_color)
    if contact.get('title') or contact.get('person_name'):
        title_font = ImageFont.truetype(font_path_regular, 20) if font_path_regular else ImageFont.load_default()
        name_font = ImageFont.truetype(font_path_bold, 26) if font_path_bold else ImageFont.load_default()
        title = contact.get('title', '')
        person = contact.get('person_name', '')
        sep = '  |  ' if title and person else ''
        probe_w = draw.textlength(person, font=name_font)
        x_name = layout.name_right_edge[0] - probe_w
        if title:
            sep_w = draw.textlength(sep, font=title_font)
            x_sep = x_name - sep_w
            title_w = draw.textlength(title, font=title_font)
            x_title = x_sep - title_w
            draw.text((x_title, layout.name_right_edge[1] + 4), title, font=title_font, fill=muted_color)
            draw.text((x_sep, layout.name_right_edge[1]), sep, font=title_font, fill=muted_color)
        draw.text((x_name, layout.name_right_edge[1]), person, font=name_font, fill=text_color)
    draw.line([(layout.name_right_edge[0] - 700, layout.divider_y), (layout.contact_right_edge_x, layout.divider_y)], fill=muted_color, width=1)
    contact_font = ImageFont.truetype(font_path_regular, 19) if font_path_regular else ImageFont.load_default()
    lines = []
    if contact.get('mobile'):
        lines.append('Mobile.  ' + contact['mobile'])
    if contact.get('email'):
        lines.append('E-mail.  ' + contact['email'])
    if contact.get('address'):
        lines.append('Address.  ' + contact['address'])
    y = layout.contact_start_y
    for line in lines:
        _draw_right_aligned(draw, (layout.contact_right_edge_x, y), line, contact_font, text_color)
        y += layout.contact_line_gap
    return card