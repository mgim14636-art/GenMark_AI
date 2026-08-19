# -*- coding: utf-8 -*-
"""strip_stray_specks - Recraft 벡터 응답에 섞여 나오는 미세 조각 path 제거.

실측: "GlowLab" 잎+물방울 아이콘에서 path 8개 중 5개가 캔버스 대각선의 1% 미만인
스크래치였고, 그중 하나는 눈에 보일 만큼 커서 로고가 "깨진" 것처럼 보였다.
"""
from app.services.logo_gen_service import strip_stray_specks

VIEWBOX = '<svg viewBox="0 0 1000 1000">'


def _svg(*paths: str) -> str:
    return VIEWBOX + "".join(paths) + "</svg>"


def _path(d: str) -> str:
    return f'<path fill="#000" d="{d}"/>'


BIG_SHAPE = _path("M 100 100 L 900 100 L 900 900 L 100 900 Z")  # diag ~113% of canvas


def test_tiny_disconnected_path_is_removed():
    speck = _path("M 500 500 L 505 502")  # diag ~0.5%
    svg = _svg(BIG_SHAPE, speck)
    cleaned = strip_stray_specks(svg)
    assert cleaned.count("<path") == 1
    assert "500 500" not in cleaned


def test_legitimate_small_shape_is_kept():
    # 캔버스 대각선의 5% - 임계값(2%)보다 커서 노이즈로 오판되면 안 된다.
    small_but_real = _path("M 400 400 L 450 400 L 450 450 L 400 450 Z")
    svg = _svg(BIG_SHAPE, small_but_real)
    cleaned = strip_stray_specks(svg)
    assert cleaned.count("<path") == 2


def test_no_viewbox_returns_unchanged():
    svg = "<svg>" + _path("M 0 0 L 1 1") + "</svg>"
    assert strip_stray_specks(svg) == svg


def test_only_speck_present_is_removed_leaving_no_paths():
    svg = _svg(_path("M 1 1 L 2 2"))
    cleaned = strip_stray_specks(svg)
    assert cleaned.count("<path") == 0
