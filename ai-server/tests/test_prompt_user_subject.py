# -*- coding: utf-8 -*-
"""사용자가 지정한 형태(logo_shape / additional_requirements) 처리 정합성.

_resolve_motif와 build_prompt_from_survey가 같은 입력을 다르게 판정하면
"the exact user-requested subject"라고만 하고 그 subject가 뭔지는 한 번도
말하지 않는 프롬프트가 나간다. 모델은 정체불명의 지시를 받고, 모티프 풀
폴백까지 건너뛰어 시안이 전부 같은 프롬프트가 된다.
"""
import pytest

from app.services.prompt_service import (
    MOTIF_MAP,
    _resolve_motif,
    _usable_user_subject,
    build_prompt_from_survey,
)

DANGLING = "the exact user-requested subject"

BASE = {
    "ci_bi": "CI",
    "company_name": "루나",
    "industry": "COSMETICS",
    "tone": "minimal",
    "style": "combination",
    "color_mode": "MANUAL",
    "color_manual": ["#396FC8"],
}


def _prompt(vi=0, **extra):
    return build_prompt_from_survey({**BASE, **extra}, variant_index=vi)


# --- 번역 실패로 한글이 남은 경우 -------------------------------------------
def test_korean_subject_is_dropped_everywhere():
    """한글이 남으면 두 곳 모두 '못 쓰는 입력'으로 봐야 한다."""
    survey = {**BASE, "additional_requirements": "달 모양"}
    assert _usable_user_subject(survey) == ""
    assert _resolve_motif("뷰티", survey, 0) != DANGLING


def test_korean_subject_does_not_leave_dangling_reference():
    prompt = _prompt(additional_requirements="달 모양")
    assert DANGLING not in prompt, "설명 없는 지시가 프롬프트에 남았다"
    assert "달 모양" not in prompt, "한글이 영어 프롬프트에 흘렀다"


def test_korean_subject_falls_back_to_motif_pool():
    """폴백이 살아야 시안마다 다른 모티프가 배정된다."""
    prompt = _prompt(additional_requirements="달 모양")
    assert any(m in prompt for m in MOTIF_MAP["뷰티"]), "모티프 풀 폴백이 동작하지 않았다"


def test_korean_subject_keeps_variant_diversity():
    """Recraft는 시드를 지원하지 않아 프롬프트가 유일한 다양성 수단이다."""
    prompts = {_prompt(vi, additional_requirements="달 모양") for vi in range(4)}
    assert len(prompts) > 1, "시안 4장이 모두 같은 프롬프트다"


# --- 번역이 성공한 경우 -------------------------------------------------------
def test_translated_subject_is_used():
    prompt = _prompt(logo_shape_en="a crescent moon")
    assert "a crescent moon" in prompt
    assert DANGLING in prompt  # 이때는 앞 문장이 subject를 설명하므로 정상


def test_translated_subject_priority_over_raw():
    """logo_shape_en(번역본)이 원문보다 우선한다."""
    survey = {**BASE, "logo_shape": "달 모양", "logo_shape_en": "a crescent moon"}
    assert _usable_user_subject(survey) == "a crescent moon"


@pytest.mark.parametrize("field", ["logo_shape_en", "logo_shape", "additional_requirements"])
def test_english_input_accepted_from_any_field(field):
    assert _usable_user_subject({**BASE, field: "a crescent moon"}) == "a crescent moon"


def test_blank_input_is_empty():
    assert _usable_user_subject(BASE) == ""
    assert _usable_user_subject({**BASE, "logo_shape": "   "}) == ""
