"""Generate private, print-oriented SVG/PDF versions of a business card.

The public preview remains the existing Pillow PNG.  These assets use the same
1050x600 coordinate system, while declaring the physical Korean card size
(90x50 mm). Text is converted to glyph paths so the receiver does not need the
Pretendard font installed.
"""
import base64
import copy
import re
import xml.etree.ElementTree as ET
from html import escape
from io import BytesIO
from typing import Optional, Tuple

from PIL import Image

from app.services.business_card import CardLayout, _auto_text_color, _luma
from app.services.svg_composer import _glyph_outlines

_UNSAFE_XML = re.compile(r"<!DOCTYPE|<!ENTITY", re.IGNORECASE)


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _safe_logo_root(svg: str) -> ET.Element:
    if not svg or _UNSAFE_XML.search(svg):
        raise ValueError("Unsafe logo SVG")
    root = ET.fromstring(svg)
    if _local_name(root.tag) != "svg":
        raise ValueError("Logo SVG root must be svg")
    for element in root.iter():
        if _local_name(element.tag) in {"script", "foreignobject"}:
            raise ValueError("Unsafe logo SVG element")
        for name, value in element.attrib.items():
            local = _local_name(name)
            normalized = (value or "").strip().lower().replace(" ", "")
            if local.startswith("on") or "javascript:" in normalized:
                raise ValueError("Unsafe logo SVG attribute")
            if local == "href" and value and not value.startswith("#"):
                raise ValueError("External logo SVG references are not allowed")
    return root


def _is_white(value: str) -> bool:
    compact = (value or "").lower().replace(" ", "")
    return compact in {"white", "#fff", "#ffffff", "rgb(255,255,255)"}


def _front_logo(root: ET.Element) -> ET.Element:
    root = copy.deepcopy(root)
    for element in root.iter():
        for attr in ("fill", "stroke"):
            value = element.attrib.get(attr)
            if not value or value == "none" or value.startswith("url("):
                continue
            element.set(attr, "none" if _is_white(value) else "#ffffff")
        # Inline styles are uncommon in generated logos and difficult to recolor
        # safely. Removing them lets presentation attributes above be authoritative.
        element.attrib.pop("style", None)
    return root


def _png_data_uri(image: Image.Image, max_size: Tuple[int, int]) -> str:
    image = image.copy()
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    buf = BytesIO()
    image.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _logo_element(
    source_svg: Optional[str], fallback: Image.Image, box: Tuple[int, int, int, int], front: bool
) -> str:
    x0, y0, x1, y1 = box
    width, height = x1 - x0, y1 - y0
    if source_svg:
        try:
            root = _safe_logo_root(source_svg)
            if front:
                root = _front_logo(root)
            root.set("x", str(x0))
            root.set("y", str(y0))
            root.set("width", str(width))
            root.set("height", str(height))
            root.set("preserveAspectRatio", "xMidYMid meet")
            return ET.tostring(root, encoding="unicode")
        except (ET.ParseError, ValueError):
            pass
    href = escape(_png_data_uri(fallback, (width, height)), quote=True)
    return (
        f'<image x="{x0}" y="{y0}" width="{width}" height="{height}" '
        f'preserveAspectRatio="xMidYMid meet" href="{href}"/>'
    )


def _text_path(text: str, font_path: str, size: float, x: float, baseline: float,
               fill: str, anchor: str = "start") -> str:
    if not text:
        return ""
    paths, units, upem, _ascender, _descender = _glyph_outlines(text, font_path)
    scale = size / upem
    if anchor == "middle":
        x -= units * scale / 2
    elif anchor == "end":
        x -= units * scale
    return "\n".join(
        f'<path d="{escape(d, quote=True)}" transform="translate({x + offset * scale:.3f},{baseline:.3f}) '
        f'scale({scale:.7f},{-scale:.7f})" fill="{fill}"/>'
        for d, offset in paths
    )


def _rgb(color: tuple) -> str:
    return f"rgb({color[0]},{color[1]},{color[2]})"


def compose_business_card_svgs(
    logo_svg: Optional[str], logo_front: Image.Image, logo_back: Image.Image,
    brand: str, tagline: str, contact: dict, front_bg: tuple, back_bg: tuple,
    font_bold: str, font_regular: str, layout: CardLayout = CardLayout(),
) -> Tuple[str, str]:
    text_front = _rgb(_auto_text_color(front_bg))
    front_box = layout.logo_box_front if brand else layout.logo_box_front_solo
    front_parts = [_logo_element(logo_svg, logo_front, front_box, True)]
    if brand:
        front_parts.append(_text_path(brand, font_bold, 40, layout.brand_name_center[0],
                                      layout.brand_name_center[1] + 14, text_front, "middle"))
        if tagline:
            front_parts.append(_text_path(tagline, font_regular, 18, layout.tagline_center[0],
                                          layout.tagline_center[1] + 6, text_front, "middle"))

    text_back_rgb = _auto_text_color(back_bg)
    text_back = _rgb(text_back_rgb)
    muted_rgb = tuple(max(0, min(255, c + (30 if _luma(back_bg) < 128 else -60))) for c in text_back_rgb)
    muted = _rgb(muted_rgb)
    back_box = layout.logo_box_back if brand else layout.logo_box_back_solo
    back_parts = [_logo_element(logo_svg, logo_back, back_box, False)]
    if brand:
        back_parts.append(_text_path(brand, font_bold, 26, layout.brand_name_pos_back[0],
                                     layout.brand_name_pos_back[1] + 25, text_back))
        if tagline:
            back_parts.append(_text_path(tagline, font_regular, 13, layout.tagline_pos_back[0],
                                         layout.tagline_pos_back[1] + 13, text_back))

    title = contact.get("title", "")
    person = contact.get("person_name", "")
    name_line = "  |  ".join(value for value in (title, person) if value)
    if name_line:
        back_parts.append(_text_path(name_line, font_bold, 24, layout.name_right_edge[0],
                                     layout.name_right_edge[1] + 25, text_back, "end"))
    back_parts.append(
        f'<line x1="{layout.name_right_edge[0] - 700}" y1="{layout.divider_y}" '
        f'x2="{layout.contact_right_edge_x}" y2="{layout.divider_y}" stroke="{muted}" stroke-width="1"/>'
    )
    lines = []
    if contact.get("mobile"):
        lines.append("Mobile.  " + contact["mobile"])
    if contact.get("email"):
        lines.append("E-mail.  " + contact["email"])
    if contact.get("address"):
        lines.append("Address.  " + contact["address"])
    for index, line in enumerate(lines):
        back_parts.append(_text_path(line, font_regular, 19, layout.contact_right_edge_x,
                                     layout.contact_start_y + index * layout.contact_line_gap + 19,
                                     text_back, "end"))

    def document(bg: tuple, parts: list[str]) -> str:
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" width="87.5mm" height="50mm" '
            f'viewBox="0 0 {layout.width} {layout.height}">\n'
            f'<rect width="{layout.width}" height="{layout.height}" fill="{_rgb(bg)}"/>\n'
            + "\n".join(parts) + "\n</svg>"
        )

    return document(front_bg, front_parts), document(back_bg, back_parts)


def svg_to_pdf(svg: str, raster_fallback: Optional[Image.Image] = None) -> bytes:
    """Convert SVG to a vector PDF, with a Windows-dev fallback.

    The Linux container includes Cairo and therefore takes the vector path. Some
    Windows test environments have the Python package but not the native Cairo
    DLL; there we still return a correctly sized, 300-dpi raster PDF so PNG
    preview generation never regresses.
    """
    try:
        import cairosvg

        return cairosvg.svg2pdf(bytestring=svg.encode("utf-8"))
    except (ImportError, OSError):
        if raster_fallback is None:
            raise
        buf = BytesIO()
        # 87.5x50 mm at 300 dpi. Resizing avoids changing the physical ratio in
        # the native-Cairo-free Windows development fallback.
        fallback_size = (round(87.5 / 25.4 * 300), round(50 / 25.4 * 300))
        raster_fallback.convert("RGB").resize(fallback_size, Image.Resampling.LANCZOS).save(
            buf, format="PDF", resolution=300.0
        )
        return buf.getvalue()
