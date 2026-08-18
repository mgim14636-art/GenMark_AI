# -*- coding: utf-8 -*-
"""락업 정규화 — 심볼 크기·여백·무게중심을 시안마다 동일하게 고정한다.

생성 모델은 마크를 매번 다른 크기로 그려 준다. 그 상태로 브랜드명을 붙이면
시안마다 심볼:글자 비율이 제각각이라 "대충 얹은" 인상이 된다(실측 확인됨 -
같은 4시안 안에서 심볼 크기가 2배 이상 차이).
"""
from PIL import Image, ImageDraw

from app.services.logo_composer import (
    LOCKUP_CANVAS_PX,
    LOCKUP_SYMBOL_HEIGHT_RATIO,
    LOCKUP_SYMBOL_MAX_WIDTH_RATIO,
    LOCKUP_TOP_MARGIN_RATIO,
    _foreground_bbox,
    normalize_lockup,
    recenter_lockup,
)

WHITE = (255, 255, 255)
INK = (15, 95, 102)


def _symbol(px=1024, frac=0.6, wide=False):
    im = Image.new("RGB", (px, px), WHITE)
    c, r = px / 2, px * frac / 2
    box = (c - (r * 1.6 if wide else r), c - r, c + (r * 1.6 if wide else r), c + r)
    ImageDraw.Draw(im).ellipse(box, outline=INK, width=8)
    return im


def _height_ratio(img):
    bbox = _foreground_bbox(img, WHITE)
    return (bbox[3] - bbox[1]) / img.height


def test_symbol_scaled_to_fixed_height_ratio():
    canvas, _ = normalize_lockup(_symbol(frac=0.6), WHITE)
    assert abs(_height_ratio(canvas) - LOCKUP_SYMBOL_HEIGHT_RATIO) < 0.02


def test_different_input_sizes_converge():
    """이게 핵심 - 큰 마크와 작은 마크가 같은 크기로 나와야 한다."""
    big, _ = normalize_lockup(_symbol(frac=0.95), WHITE)
    small, _ = normalize_lockup(_symbol(frac=0.25), WHITE)
    assert abs(_height_ratio(big) - _height_ratio(small)) < 0.02


def test_canvas_is_square_and_fixed():
    canvas, _ = normalize_lockup(_symbol(px=512), WHITE)
    assert canvas.size == (LOCKUP_CANVAS_PX, LOCKUP_CANVAS_PX)


def test_wide_symbol_is_width_capped():
    """가로로 긴 마크가 캔버스를 넘지 않아야 한다."""
    canvas, bbox = normalize_lockup(_symbol(frac=0.9, wide=True), WHITE)
    assert (bbox[2] - bbox[0]) <= LOCKUP_CANVAS_PX * LOCKUP_SYMBOL_MAX_WIDTH_RATIO + 2


def test_top_margin_applied():
    _, bbox = normalize_lockup(_symbol(), WHITE)
    assert abs(bbox[1] / LOCKUP_CANVAS_PX - LOCKUP_TOP_MARGIN_RATIO) < 0.01


def test_blank_input_is_returned_untouched():
    blank = Image.new("RGB", (200, 200), WHITE)
    out, _ = normalize_lockup(blank, WHITE)
    assert out is blank


def test_recenter_balances_top_and_bottom_margins():
    canvas = Image.new("RGB", (400, 400), WHITE)
    ImageDraw.Draw(canvas).rectangle((100, 20, 300, 120), fill=INK)  # 위로 쏠린 덩어리
    out = recenter_lockup(canvas, WHITE)
    top, bottom = _foreground_bbox(out, WHITE)[1], _foreground_bbox(out, WHITE)[3]
    assert abs(top - (out.height - bottom)) <= 2


def test_recenter_preserves_content_height():
    canvas = Image.new("RGB", (400, 400), WHITE)
    ImageDraw.Draw(canvas).rectangle((100, 20, 300, 120), fill=INK)
    before = _foreground_bbox(canvas, WHITE)
    after = _foreground_bbox(recenter_lockup(canvas, WHITE), WHITE)
    assert (after[3] - after[1]) == (before[3] - before[1])


def test_recenter_noop_on_blank():
    blank = Image.new("RGB", (100, 100), WHITE)
    assert recenter_lockup(blank, WHITE) is blank
