# -*- coding: utf-8 -*-
"""단색 지정 시 결과물이 실제로 단색인지 고정한다.

프롬프트에 "single stroke color"를 명시해도 모델이 옅은 보조색을 얹어 2색으로
내보내는 사례가 반복 확인됐다(실측 - 청록 1색 지정에 옅은 파랑이 추가됨).
벡터 응답은 색이 fill/stroke 속성값이라 생성 후 확정적으로 통일할 수 있다.
"""
import re

import pytest

from app.services.logo_gen_service import _single_manual_color, force_single_color

TEAL = "#0f5f66"

SVG = (
    '<svg viewBox="0 0 100 100">'
    '<path d="M0 0h100v100H0z" fill="#FFFFFF"/>'
    '<path d="M10 10" fill="none" stroke="#0f5f66" stroke-width="3"/>'
    '<path d="M20 20" fill="#9fc6e0" stroke="#9FC6E0"/>'
    '<g style="fill:#9fc6e0;stroke:#0f5f66"/>'
    '<path d="M30 30" fill="url(#grad)"/>'
    "</svg>"
)


def test_only_two_colors_survive():
    """결과는 지정색과 흰색 두 가지뿐이어야 한다."""
    out = force_single_color(SVG, TEAL)
    colors = {c.lower() for c in re.findall(r"#[0-9a-fA-F]{3,6}", out)}
    assert colors <= {TEAL, "#ffffff"}


def test_white_is_preserved():
    """흰색까지 칠하면 선 로고의 빈 속과 뚫어 둔 구멍이 메워진다."""
    assert "#ffffff" in force_single_color(SVG, TEAL).lower()


def test_light_fill_becomes_white_not_ink():
    """Recraft 벡터는 stroke 없이 [진한 윤곽 도형 + 옅은 안쪽 면] 쌍으로 그린다.

    옅은 안쪽 면까지 지정색으로 칠하면 속이 메워져 선 로고가 면 로고가 된다
    (실측 확인됨 - 선 스타일로 뽑은 4장이 전부 굵은 면으로 나왔다).
    """
    out = force_single_color('<path fill="#eef5f4"/>', TEAL).lower()
    assert "#ffffff" in out and TEAL not in out


def test_midtone_secondary_is_unified_to_ink():
    """옅지 않은 보조색은 통일 대상이다 - 이게 원래 잡으려던 2색 문제."""
    out = force_single_color('<path fill="#9fc6e0"/>', TEAL).lower()
    assert TEAL in out


def test_none_and_url_refs_untouched():
    out = force_single_color(SVG, TEAL)
    assert 'fill="none"' in out
    assert 'fill="url(#grad)"' in out


def test_style_attribute_colors_also_replaced():
    out = force_single_color('<g style="fill:#9fc6e0;stroke:#abc"/>', TEAL)
    assert "#9fc6e0" not in out and "#abc" not in out


@pytest.mark.parametrize("bad", ["", None, "teal", "#zzz"])
def test_invalid_color_is_a_noop(bad):
    assert force_single_color(SVG, bad) == SVG


@pytest.mark.parametrize(
    "survey,expected",
    [
        ({"color_mode": "manual", "color_manual": [TEAL]}, TEAL),
        ({"color_mode": "MANUAL", "colors": [TEAL]}, TEAL),
        ({"color_mode": "manual", "color_manual": [TEAL, "#abc"]}, None),
        ({"color_mode": "manual", "color_manual": []}, None),
        # color_mode는 보지 않는다 - prompt_service._manual_color_names와 같은 규칙.
        # 추천 팔레트에서 색을 하나로 줄인 사용자도 단색 결과를 받아야 한다.
        ({"color_mode": "TONE", "color_manual": [TEAL]}, TEAL),
        ({"colors": [TEAL]}, TEAL),
        ({}, None),
    ],
)
def test_single_manual_color(survey, expected):
    assert _single_manual_color(survey) == expected
