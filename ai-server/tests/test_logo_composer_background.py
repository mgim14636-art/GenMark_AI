# -*- coding: utf-8 -*-
"""투명 배경 심볼이 검정으로 칠해지지 않는지 고정한다.

logo_gen_service.strip_background()가 SVG 배경 path를 제거해 투명 배경을
돌려준다(다운로드·색 치환 편집용). 그 이미지를 _flatten_background가 그대로
convert("RGB")하면 투명 픽셀이 (0,0,0)이 되고, 모서리 색으로 배경을 추정하는
로직이 캔버스 전체를 검정으로 칠한다.

면 스타일에서는 도형이 캔버스를 채워 잘 드러나지 않았고, 선 스타일로 바꾸자
결과물의 86%가 검정으로 나왔다(실측 확인됨).
"""
from PIL import Image, ImageDraw

from app.services.logo_composer import _composite_on_white, _flatten_background

NAVY = (5, 32, 158)
WHITE = (255, 255, 255)


def _transparent_line_logo(size=256):
    """오늘 결과와 같은 조건 — 투명 배경 + 남색 외곽선."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse(
        (size * 0.3, size * 0.3, size * 0.7, size * 0.7), outline=NAVY + (255,), width=8
    )
    return im


def test_transparent_background_becomes_white_not_black():
    flat, bg = _flatten_background(_transparent_line_logo())
    assert bg == WHITE, f"배경색을 {bg} 로 추정했다"
    assert flat.getpixel((2, 2)) == WHITE


def test_symbol_survives_compositing():
    """배경만 바뀌고 심볼 획은 남아야 한다."""
    flat, _ = _flatten_background(_transparent_line_logo())
    colors = {flat.getpixel((x, y)) for x in range(0, 256, 4) for y in range(0, 256, 4)}
    assert any(c != WHITE for c in colors), "심볼이 배경에 먹혔다"


def test_opaque_white_background_unchanged():
    """기존 경로(흰 배경 래스터)는 그대로 동작해야 한다."""
    im = Image.new("RGB", (128, 128), WHITE)
    ImageDraw.Draw(im).ellipse((40, 40, 88, 88), outline=NAVY, width=6)
    _, bg = _flatten_background(im)
    assert bg == WHITE


def test_opaque_colored_background_still_detected():
    """투명이 아닌 유색 배경은 여전히 그 색으로 추정해야 한다."""
    im = Image.new("RGB", (128, 128), (240, 234, 220))
    _, bg = _flatten_background(im)
    assert bg == (240, 234, 220)


def test_composite_on_white_handles_modes():
    assert _composite_on_white(Image.new("RGB", (4, 4), NAVY)).mode == "RGB"
    assert _composite_on_white(Image.new("RGBA", (4, 4), (0, 0, 0, 0))).getpixel((0, 0)) == WHITE
    assert _composite_on_white(Image.new("LA", (4, 4), (0, 0))).getpixel((0, 0)) == WHITE


def test_fully_transparent_image_is_all_white():
    flat, bg = _flatten_background(Image.new("RGBA", (64, 64), (0, 0, 0, 0)))
    assert bg == WHITE
    assert flat.convert("RGB").getextrema() == ((255, 255), (255, 255), (255, 255))
