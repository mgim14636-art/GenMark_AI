import pytest

from app.services.prompt_service import (
    MOTIF_MAP,
    TARGET_AGE_MODIFIER,
    VALUE_KEYWORD_MAP,
    VALUE_MOTIF_BIAS,
    _normalize_survey,
    _raw_value_keys,
    _resolve_values,
    build_prompt_legacy,
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
        "logo_shape_en": "a refined blooming flower emblem",
    }

    normalized = _normalize_survey(survey)
    assert normalized["industry"] == "뷰티"
    assert normalized["tone"] == "친근하고 다정한"
    assert normalized["color_mode"] == "manual"
    assert normalized["style"] == "혼합형"

    prompts = [build_prompt_legacy(survey, variant_index=index) for index in range(4)]

    assert len(set(prompts)) == 4
    for prompt in prompts:
        assert "a beauty and cosmetics brand" in prompt
        assert "a friendly, approachable feeling" in prompt
        # 텍스트 인코더는 헥사 코드를 색으로 해석하지 못해 색 이름으로 바꿔 넣는다
        assert "#9765e9" not in prompt
        assert "rendered strictly in vivid lilac as the single flat color" in prompt
        assert "color palette" not in prompt
        assert "designed to pair cleanly with a separately typeset brand name" in prompt
        assert "a refined blooming flower emblem" in prompt
        assert "세련된 꽃 모양의 이미지를 꼭 추가해 줬으면 좋겠어" not in prompt
        assert "finished and complete rather than a sketch." in prompt
        assert not any(fallback in prompt for fallback in FALLBACK_MOTIFS)


@pytest.mark.parametrize(
    ("field", "current_value", "canonical_value"),
    [
        ("industry", "FASHION", "패션"),
        ("industry", "FOOD", "푸드·카페"),
        ("industry", "HEALTH_WELLNESS", "헬스·웰니스"),
        ("industry", "TECH", "테크"),
        ("industry", "EDUCATION", "교육"),
        ("industry", "PET", "펫"),
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
    prompts = [build_prompt_legacy(survey, index) for index in range(4)]

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
    prompt = build_prompt_legacy(survey, 0)
    assert "ivory and gold color palette" in prompt
    assert "#" not in prompt


def test_korean_free_text_values_do_not_leak_into_prompt():
    """영문 프롬프트에 한글 조각이 문장 없이 박히던 문제."""
    survey = {"industry": "COSMETICS", "ci_bi": "CI", "company_values_text": "신뢰, 혁신"}
    prompt = build_prompt_legacy(survey, 0)
    assert "신뢰" not in prompt and "혁신" not in prompt

    # 사전에 있는 키워드는 영어로 바뀌어 남는다
    survey["company_values_text"] = "프리미엄, 자연주의"
    prompt = build_prompt_legacy(survey, 0)
    assert "premium, luxurious" in prompt and "naturalistic, botanical" in prompt


def test_default_variants_do_not_force_fixed_fallback_shapes():
    prompts = [
        build_prompt_legacy({"industry": "OTHER", "brand_name": "GenMark"}, index)
        for index in range(4)
    ]

    assert len(set(prompts)) == 4
    assert all("an original brand-specific subject" in prompt for prompt in prompts)
    assert all(not any(motif in prompt for motif in FALLBACK_MOTIFS) for prompt in prompts)


@pytest.mark.parametrize(
    ("industry", "descriptor"),
    [
        ("FASHION", "fashion and apparel"),
        ("FOOD", "food, cafe, or bakery"),
        ("HEALTH_WELLNESS", "health and wellness"),
        ("TECH", "technology and software"),
        ("EDUCATION", "education and learning"),
        ("PET", "pet care and companion-animal"),
    ],
)
def test_supported_industries_keep_distinct_visual_context(industry, descriptor):
    prompt = build_prompt_legacy({"industry": industry, "brand_name": "GenMark"})
    assert descriptor in prompt
    assert "an original brand-specific subject" not in prompt


def test_logo_shape_english_is_prioritized_without_hangul_leak():
    prompt = build_prompt_legacy({
        "industry": "TECH",
        "logo_shape": "달 모양",
        "logo_shape_en": "an elegant crescent-moon emblem",
    })
    assert "an elegant crescent-moon emblem" in prompt
    assert "달 모양" not in prompt
    assert "one to three cohesive shapes" in prompt
    assert "generic stock-icon look" in prompt


def test_selected_value_bias_changes_visual_motif():
    prompt = build_prompt_legacy({
        "industry": "COSMETICS",
        "brand_name": "GenMark",
        "brand_values": ["scientific"],
    })
    assert any(motif in prompt for motif in VALUE_MOTIF_BIAS["과학적 검증"])


# --- 프론트 → AI서버 값 정합성 -------------------------------------------
# 프론트(App.tsx)가 보내는 값과 prompt_service의 사전 키가 어긋나면 조용히
# 정보가 누락된다(에러가 안 난다). 실제로 가치 칩 9개와 "전 연령층"이 이 방식으로
# 통째로 빠져 있었다. 화면 목록이 바뀌면 여기서 먼저 깨지도록 못 박아 둔다.

# App.tsx: type CoreValue
FRONTEND_VALUE_IDS = [
    "vegan", "lowIrritation", "derma", "cleanBeauty", "natural",
    "premium", "sustainable", "scientific", "reasonable",
]
# App.tsx: target-audience-grid
FRONTEND_TARGET_AGES = ["10-20대", "30-40대", "50-60대", "전 연령층"]


@pytest.mark.parametrize("value_id", FRONTEND_VALUE_IDS)
def test_frontend_value_chip_maps_to_english_and_motif(value_id):
    survey = _normalize_survey(
        {"ci_bi": "BI", "industry": "COSMETICS", "brand_values": [value_id]}
    )
    key = _raw_value_keys(survey)[0]

    # 한글 사전 키로 치환됐는가 (영문 id가 그대로 남으면 실패)
    assert key in VALUE_KEYWORD_MAP, f"{value_id} → {key} 가 VALUE_KEYWORD_MAP에 없음"

    # 프롬프트 문장에 영문으로 실리는가
    assert _resolve_values(survey).startswith("The brand values are")

    # 모티프 후보가 잡히는가 (가치 기반 모티프 선정의 전제)
    assert VALUE_MOTIF_BIAS.get(key), f"{key} 에 대응 모티프가 없음"


@pytest.mark.parametrize("target_age", FRONTEND_TARGET_AGES)
def test_frontend_target_age_maps_to_modifier(target_age):
    survey = _normalize_survey({"ci_bi": "BI", "target_age": target_age})
    assert TARGET_AGE_MODIFIER.get(survey["target_age"]), (
        f"{target_age} → {survey['target_age']} 에 대응 문구가 없음"
    )
