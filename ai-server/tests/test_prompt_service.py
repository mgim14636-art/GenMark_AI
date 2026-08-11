import pytest

from app.services.prompt_service import _normalize_survey, build_prompt_from_survey


FALLBACK_MOTIFS = (
    "orbiting ring",
    "star burst",
    "infinity loop",
    "abstract geometric emblem",
)


def test_current_survey_contract_prioritizes_explicit_flower_motif_in_all_variants():
    survey = {
        "industry": "COSMETICS",
        "tone": "friendly",
        "color_mode": "MANUAL",
        "color_manual": ["#9765e9"],
        "style": "combination",
        "additional_requirements": "세련된 꽃 모양의 이미지를 꼭 추가해 줬으면 좋겠어",
    }

    normalized = _normalize_survey(survey)
    assert normalized["industry"] == "뷰티"
    assert normalized["tone"] == "친근하고 다정한"
    assert normalized["color_mode"] == "manual"
    assert normalized["style"] == "혼합형"

    prompts = [build_prompt_from_survey(survey, variant_index=index) for index in range(4)]

    assert len(set(prompts)) == 4
    for prompt in prompts:
        assert "a beauty and cosmetics brand" in prompt
        assert "a friendly, approachable feeling" in prompt
        assert "#9765e9 color palette" in prompt
        assert "combines a graphic symbol with an abstract letterform-like silhouette" in prompt
        assert "세련된 꽃 모양의 이미지를 꼭 추가해 줬으면 좋겠어" in prompt
        assert "finished and complete rather than a sketch." in prompt
        assert not any(fallback in prompt for fallback in FALLBACK_MOTIFS)


@pytest.mark.parametrize(
    ("field", "current_value", "canonical_value"),
    [
        ("industry", "FASHION", "기타"),
        ("industry", "FOOD", "기타"),
        ("industry", "TECH", "기타"),
        ("industry", "OTHER", "기타"),
        ("tone", "professional", "전문적이고 신뢰감 있는"),
        ("tone", "warm", "감성적이고 따뜻한"),
        ("tone", "trendy", "유니크하고 트렌디한"),
        ("tone", "minimal", "미니얼하고 직관적인"),
        ("style", "symbol", "심볼"),
        ("style", "wordmark", "워드마크"),
        ("style", "lettermark", "레터마크"),
        ("color_mode", "AI", "ai"),
        ("target_age", "20-30", "20-30대"),
    ],
)
def test_current_survey_aliases_are_normalized(field, current_value, canonical_value):
    assert _normalize_survey({field: current_value})[field] == canonical_value


def test_default_variants_do_not_force_fixed_fallback_shapes():
    prompts = [
        build_prompt_from_survey({"industry": "OTHER", "brand_name": "GenMark"}, index)
        for index in range(4)
    ]

    assert len(set(prompts)) == 4
    assert all("an original brand-specific subject" in prompt for prompt in prompts)
    assert all(not any(motif in prompt for motif in FALLBACK_MOTIFS) for prompt in prompts)
