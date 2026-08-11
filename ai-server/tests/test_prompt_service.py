import pytest

from app.services.prompt_service import (
    MOTIF_MAP,
    _normalize_survey,
    build_prompt_from_survey,
)


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
        # 텍스트 인코더는 헥사 코드를 색으로 해석하지 못해 색 이름으로 바꿔 넣는다
        assert "#9765e9" not in prompt
        assert "violet color palette" in prompt
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


def test_beauty_variants_use_concrete_motifs():
    """뷰티는 시안마다 구체 모티프가 배정돼야 한다.

    열린 지시만 주면 모델이 매번 비슷한 추상 도형으로 수렴해 4장이 사실상
    같아 보였다(실측 확인됨).
    """
    survey = {"industry": "COSMETICS", "brand_name": "GenMark", "tone": "friendly"}
    prompts = [build_prompt_from_survey(survey, index) for index in range(4)]

    assert len(set(prompts)) == 4
    assert all("an original brand-specific subject" not in prompt for prompt in prompts)

    used = set()
    for prompt in prompts:
        hit = [m for m in MOTIF_MAP["뷰티"] if m in prompt]
        assert len(hit) == 1, f"구체 모티프가 정확히 하나 배정돼야 한다: {hit}"
        used.add(hit[0])
    assert len(used) == 4, "시안마다 서로 다른 모티프가 배정돼야 한다"


def test_hex_colors_are_converted_to_names():
    survey = {
        "industry": "COSMETICS", "color_mode": "MANUAL",
        "color_manual": ["#F8F6F0", "#C6A86E"],
    }
    prompt = build_prompt_from_survey(survey, 0)
    assert "ivory and gold color palette" in prompt
    assert "#" not in prompt


def test_korean_free_text_values_do_not_leak_into_prompt():
    """영문 프롬프트에 한글 조각이 문장 없이 박히던 문제."""
    survey = {"industry": "COSMETICS", "ci_bi": "CI", "company_values_text": "신뢰, 혁신"}
    prompt = build_prompt_from_survey(survey, 0)
    assert "신뢰" not in prompt and "혁신" not in prompt

    # 사전에 있는 키워드는 영어로 바뀌어 남는다
    survey["company_values_text"] = "프리미엄, 자연주의"
    prompt = build_prompt_from_survey(survey, 0)
    assert "premium, luxurious" in prompt and "naturalistic, botanical" in prompt


def test_default_variants_do_not_force_fixed_fallback_shapes():
    prompts = [
        build_prompt_from_survey({"industry": "OTHER", "brand_name": "GenMark"}, index)
        for index in range(4)
    ]

    assert len(set(prompts)) == 4
    assert all("an original brand-specific subject" in prompt for prompt in prompts)
    assert all(not any(motif in prompt for motif in FALLBACK_MOTIFS) for prompt in prompts)
