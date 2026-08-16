# -*- coding: utf-8 -*-
"""색상 지시가 지정한 색 수와 일치하는지 고정한다.

색을 하나만 골랐는데 "in a deep navy color palette"라고 쓰면 'palette'라는 단어가
여러 색을 암시해 모델이 보조색을 끼워 넣는다. 단색 의도는 단색이라고 명시해야 한다.

주의: 이 테스트는 "지정한 색 수가 프롬프트에 정확히 반영되는가"만 본다.
사용자가 화면에서 1색을 골랐는데 DB에 2색이 저장되는 문제는 프론트 쪽이며
여기서 잡히지 않는다.
"""
import pytest

from app.services.prompt_service import (
    TONE_COLOR_MAP,
    _color_clause,
    _manual_color_names,
    build_prompt_from_survey,
)

NAVY = "#17185b"       # -> deep navy
DUSTY_ROSE = "#a45c72"  # -> dusty rose

BASE = {
    "ci_bi": "CI",
    "company_name": "Hyeonwook",
    "industry": "COSMETICS",
    "tone": "professional",
    "style": "combination",
    "color_mode": "MANUAL",
}


def _prompt(colors):
    return build_prompt_from_survey({**BASE, "color_manual": colors}, variant_index=0)


def test_single_color_is_declared_monochrome():
    prompt = _prompt([NAVY])
    assert "deep navy" in prompt
    assert "single flat color" in prompt
    assert "the exact same single color" in prompt
    # 'palette'는 보조색을 부르는 표현이라 단색일 때는 쓰지 않는다
    assert "color palette" not in prompt


def test_single_color_does_not_leak_other_colors():
    """지정하지 않은 색 이름이 프롬프트에 등장하면 안 된다."""
    prompt = _prompt([NAVY])
    assert "dusty rose" not in prompt


def test_two_colors_keep_palette_wording():
    prompt = _prompt([NAVY, DUSTY_ROSE])
    assert "deep navy and dusty rose color palette" in prompt
    assert "single flat color" not in prompt


def test_no_color_falls_back_to_tone_preset():
    prompt = _prompt([])
    assert TONE_COLOR_MAP["전문적이고 신뢰감 있는"] in prompt
    # 폴백 프리셋은 2색이므로 단색 문구가 붙으면 안 된다
    assert "single flat color" not in prompt


def test_duplicate_hex_counts_as_one_color():
    """같은 색을 두 번 고른 경우도 단색으로 취급한다."""
    assert _manual_color_names({**BASE, "color_manual": [NAVY, NAVY]}) == ["deep navy"]
    assert "single flat color" in _color_clause(
        {**BASE, "color_manual": [NAVY, NAVY]}, "전문적이고 신뢰감 있는"
    )


@pytest.mark.parametrize("mode", ["MANUAL", "manual", "Manual"])
def test_color_mode_is_case_insensitive(mode):
    """백엔드 toSurvey()는 대문자 MANUAL을 보낸다."""
    assert _manual_color_names({**BASE, "color_mode": mode, "color_manual": [NAVY]})


def test_ai_mode_uses_selected_recommended_palette_colors():
    """추천 팔레트도 사용자가 고른 HEX가 있으면 일반 톤 프리셋보다 우선한다."""
    names = _manual_color_names({**BASE, "color_mode": "ai", "color_manual": [NAVY]})
    assert names == ["deep navy"]


def test_ai_mode_without_selected_colors_falls_back_to_tone_palette():
    """선택 HEX가 없는 기존 데이터는 계속 tone 기본 팔레트를 사용한다."""
    survey = {**BASE, "color_mode": "ai", "tone": "friendly"}
    assert _manual_color_names(survey) == []
    assert _color_clause(survey, "친근하고 다정한") == "in a soft pink and light sky blue color palette"
