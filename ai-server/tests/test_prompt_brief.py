# -*- coding: utf-8 -*-
"""브리프 프롬프트(v4) — 설문 사실만 넘기고 조형은 모델에 맡긴다.

통제 실험: Recraft 사이트에서 같은 모델(V4 Vector)에 두 프롬프트를 넣었다.
짧은 브리프는 완성도 높은 락업을, 조형까지 지시한 기존 프롬프트는 동심원 선
뭉치를 만들었다. 플랫폼·모델이 같았으므로 차이는 프롬프트뿐이다.
"""
import pytest

from app.services.prompt_service import (
    BRIEF_ANGLES,
    build_prompt_brief,
    build_prompt_legacy,
)

BASE = {
    "ci_bi": "CI",
    "company_name": "Tree",
    "industry": "COSMETICS",
    "tone": "warm",
    "style": "combination",
    "color_mode": "MANUAL",
    "color_manual": ["#2f7d32"],
}

# 결과를 망가뜨린 것으로 확인된 문구들. 하나라도 되살아나면 회귀다.
HARMFUL = (
    "monoline",
    "as few strokes as possible",
    "16 pixel",
    "uniform weight",
    "negative space",
    "one to three cohesive shapes",
    "Bauhaus",
    "stock-icon",
)


def _p(vi=0, **extra):
    return build_prompt_brief({**BASE, **extra}, variant_index=vi)


def test_brief_is_short():
    """기존 프롬프트는 1,150자였다. 길이 자체가 지시를 희석했다.

    늘릴 때마다 실측으로 조형이 나빠지지 않는지 확인한 뒤에만 올린다.
    """
    assert len(_p()) < 450, _p()


@pytest.mark.parametrize("phrase", HARMFUL)
def test_no_shape_dictation(phrase):
    assert phrase.lower() not in _p().lower()


def test_brand_name_is_never_given_to_model():
    """영문 브랜드명도 모델에게 맡기면 안 된다 - 아이콘과 겹치거나 글자가 깨지는
    사고가 반복 확인됐다(실측: "GlowLab"에서 o/a가 잎 모티프에 가려짐). 항상
    심볼만 받아 이후 폰트로 합성한다."""
    prompt = _p()
    assert '"Tree"' not in prompt
    assert "designed together as one lockup" not in prompt
    assert "no letters" in prompt


def test_korean_brand_name_also_symbol_only():
    prompt = _p(company_name="루나 코스매틱")
    assert "루나" not in prompt
    assert "no letters" in prompt
    assert "lockup" not in prompt


def test_symbol_style_never_asks_for_letters():
    assert "no letters" in _p(style="symbol")


def test_manual_color_is_named():
    assert "forest green palette" in _p().lower()


def test_two_manual_colors_both_appear():
    prompt = _p(color_manual=["#2f7d32", "#8bc34a"])
    assert " and " in prompt.split("palette")[0]


def test_tone_falls_back_when_no_manual_color():
    prompt = _p(color_mode="TONE", color_manual=None)
    assert "palette" in prompt


def test_variants_differ():
    """Recraft는 시드가 없어 프롬프트가 유일한 다양성 수단이다."""
    assert len({_p(vi) for vi in range(len(BRIEF_ANGLES))}) == len(BRIEF_ANGLES)


def test_variant_angle_is_conceptual_not_formal():
    """시안별로 바꾸는 건 발상의 각도지 획 굵기가 아니다."""
    for angle in BRIEF_ANGLES:
        assert not any(h.lower() in angle.lower() for h in HARMFUL)


def test_legacy_still_available_for_comparison():
    assert len(build_prompt_legacy(BASE, 0)) > len(_p())


# --- 브랜드명은 항상 폰트로 합성한다, 모델에게 맡기지 않는다 -----------------
# 실측: 영문 브랜드명이어도 모델이 그린 락업이 아이콘과 겹치거나 글자가 깨지는
# 사고가 반복됐다("GlowLab"에서 o/a가 잎 모티프에 가려짐). 언어와 무관하게 항상
# 이 서버가 폰트로 합성해 정확한 글자를 보장한다.
def test_model_never_draws_wordmark_for_latin_name():
    from app.services.prompt_service import model_draws_wordmark

    assert model_draws_wordmark(BASE) is False


def test_composer_always_overlays_latin_name():
    from app.services.logo_composer import _wants_text_overlay

    assert _wants_text_overlay(BASE, "혼합형", "Tree") is True


def test_composer_still_overlays_korean_name():
    from app.services.logo_composer import _wants_text_overlay

    survey = {**BASE, "company_name": "루나 코스매틱"}
    assert _wants_text_overlay(survey, "혼합형", "루나 코스매틱") is True


def test_symbol_style_never_delegates_wordmark():
    from app.services.prompt_service import model_draws_wordmark

    assert model_draws_wordmark({**BASE, "style": "symbol"}) is False


# --- 사용자가 지정한 형태 ----------------------------------------------------
# 실측: "원형 틀 안의 잎사귀"를 요청했는데 결과에 원형 틀이 없었다. 형태 문구를
# "~ feeling." 문장에 섞어 넣어 모델이 분위기 서술로 읽은 탓이었다.
def test_user_shape_is_its_own_sentence():
    prompt = _p(logo_shape_en="a leaf inside a circular frame")
    assert "The mark depicts a leaf inside a circular frame." in prompt


def test_user_shape_comes_early():
    """뒤로 밀리면 앞 문장에 묻힌다. 브랜드 소개 바로 다음 줄이어야 한다."""
    prompt = _p(logo_shape_en="a leaf inside a circular frame")
    assert prompt.splitlines()[1].startswith("The mark depicts")


def test_user_shape_not_merged_into_feeling_line():
    prompt = _p(logo_shape_en="a leaf inside a circular frame")
    feeling = [l for l in prompt.splitlines() if l.endswith("feeling.")]
    assert feeling and "circular frame" not in feeling[0]


def test_translation_placeholder_is_dropped():
    """번역 실패 자리표시자는 무엇을 그리라는 지시가 없어 오히려 해롭다."""
    prompt = _p(logo_shape_en="a brand-specific motif matching the user's request")
    assert "brand-specific motif" not in prompt
    assert "The mark depicts" not in prompt


def test_no_shape_means_no_depicts_line():
    assert "The mark depicts" not in _p()


# --- 브랜드 가치 / 회사 모토 -------------------------------------------------
# CI 화면의 "회사 모토"가 companyMotto -> coreValues -> company_values_text로
# 흘러 들어온다. 브리프를 새로 쓰면서 이 문장을 빠뜨려, 사용자가 적은 모토가
# 프롬프트에 한 글자도 반영되지 않았다(실측 확인됨).
def test_brand_values_reach_the_prompt():
    prompt = _p(value_keywords_en=["natural beauty", "authenticity"])
    assert "The brand values are natural beauty, authenticity." in prompt


def test_no_values_means_no_line():
    assert "brand values" not in _p(value_keywords_en=[])


def test_korean_motto_is_not_pasted_raw():
    """한국어 원문을 그대로 넣으면 텍스트 인코더에 노이즈다."""
    prompt = _p(company_values_text="있는 그대로의 아름다움을 발견하다")
    assert "아름다움" not in prompt


def test_values_capped_at_five():
    prompt = _p(value_keywords_en=[f"v{i}" for i in range(8)])
    line = [l for l in prompt.splitlines() if "brand values" in l][0]
    assert line.count(",") == 4


# --- 워드마크를 누가 그리는가 -------------------------------------------------
# 기본은 이 서버가 폰트로 합성한다(안정적). LOGO_WORDMARK=model 이면 모델이
# 심볼과 워드마크를 한 덩어리로 그린다 - 잘 나올 때 완성도가 확실히 높지만
# 긴 이름에서 글자가 심볼에 가려지는 사고가 있어 기본값으로는 쓰지 않는다.
def _reload(mode=None):
    import importlib
    import os

    from app.services import logo_composer, prompt_service

    if mode is None:
        os.environ.pop("LOGO_WORDMARK", None)
    else:
        os.environ["LOGO_WORDMARK"] = mode
    importlib.reload(prompt_service)
    importlib.reload(logo_composer)
    return prompt_service, logo_composer


def test_default_keeps_brand_name_out_of_prompt():
    ps, _ = _reload()
    try:
        assert '"Tree"' not in ps.build_prompt_brief(BASE, 0)
        assert ps.model_draws_wordmark(BASE) is False
    finally:
        _reload()


def test_model_mode_puts_brand_name_in_prompt():
    ps, _ = _reload("model")
    try:
        prompt = ps.build_prompt_brief(BASE, 0)
        assert '"Tree"' in prompt
        assert "one lockup" in prompt
    finally:
        _reload()


def test_only_one_side_draws_the_name():
    """둘 다 켜지면 이름이 두 번 찍힌다. 정확히 한쪽만 담당해야 한다."""
    for mode in (None, "model"):
        ps, lc = _reload(mode)
        try:
            by_model = ps.model_draws_wordmark(BASE)
            by_font = lc._wants_text_overlay(BASE, "혼합형", "Tree")
            assert by_model != by_font, mode
        finally:
            _reload()


def test_korean_never_goes_to_the_model():
    """Recraft는 한글 글자를 그리지 못한다. 모드와 무관하게 제외."""
    ps, _ = _reload("model")
    try:
        assert ps.model_draws_wordmark({**BASE, "company_name": "코스메틱"}) is False
    finally:
        _reload()


def test_symbol_style_never_goes_to_the_model():
    ps, _ = _reload("model")
    try:
        assert ps.model_draws_wordmark({**BASE, "style": "symbol"}) is False
    finally:
        _reload()
