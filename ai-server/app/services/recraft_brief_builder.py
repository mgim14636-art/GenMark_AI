"""설문을 "requirements 목록 + 서술형 문단" 형식의 영문 프롬프트로 변환한다.
(Recraft 사이트에서 잘 먹힌 브리프 예시와 같은 형식)

[prompt_service.py와의 관계] prompt_service.build_prompt_from_survey는
운영 파이프라인에서 쓰는 "완전한 문장 하나로 흐르는" 프롬프트를 만든다(콤마
나열·부정문 금지 등 house rule 적용). 이 파일은 그것과 별개로 Recraft
브리프 형식만 뽑아낸다. prompt_service.py는 건드리지 않는다.
"""

INDUSTRY_LABEL_MAP = {
    "뷰티": "beauty",
    "기타": "commercial",
}

TONE_ADJECTIVE_MAP = {
    "친근하고 다정한": "friendly",
    "전문적이고 신뢰감 있는": "professional",
    "감성적이고 따뜻한": "warm",
    "유니크하고 트렌디한": "trendy",
    "미니얼하고 직관적인": "minimal",
}

TONE_DESC_MAP = {
    "친근하고 다정한": "warm, approachable, gentle",
    "전문적이고 신뢰감 있는": "professional, trustworthy, structured",
    "감성적이고 따뜻한": "calm, organic, serene",
    "유니크하고 트렌디한": "bold, distinctive, modern",
    "미니얼하고 직관적인": "clean, minimal, refined",
}

TONE_COLOR_FALLBACK_MAP = {
    "친근하고 다정한": "soft pink, light sky blue",
    "전문적이고 신뢰감 있는": "deep navy, dusty rose",
    "감성적이고 따뜻한": "soft aqua blue, sage green, sandy beige",
    "유니크하고 트렌디한": "bold black, pale grey",
    "미니얼하고 직관적인": "cobalt blue, pale sky blue",
}

TONE_STYLE_MAP = {
    "친근하고 다정한": "rounded, approachable",
    "전문적이고 신뢰감 있는": "premium, structured",
    "감성적이고 따뜻한": "minimal, fluid linework",
    "유니크하고 트렌디한": "contemporary, unconventional",
    "미니얼하고 직관적인": "minimal, clean, geometric",
}

VALUE_KEYWORD_MAP = {
    "비건": "vegan",
    "크루얼티프리": "cruelty-free",
    "더마·저자극": "dermatologically gentle",
    "클린뷰티": "clean beauty",
    "자연주의": "organic nature",
    "데일리": "everyday simplicity",
    "프리미엄": "elegance, purity, trust",
    "지속가능": "sustainability, eco-consciousness",
    "한방·전통": "heritage, tradition",
    "과학적 검증": "clinical credibility",
    "가성비": "practicality, value",
    "트렌디": "trend-forward energy",
    "심플": "simplicity",
    "고보습": "hydration, freshness",
    "감성적": "emotional warmth",
}

MOTIF_SHAPE_MAP = {
    "보석/빛": "faceted gem or radiant emblem",
    "동물/생명체": "graceful creature silhouette",
    "기하학적 도형": "geometric emblem",
    "원형/깔끔함": "circular emblem",
    "식물/자연": "botanical or leaf motif",
    "물결/리본": "flowing ribbon or wave emblem",
    "제품": "product silhouette mark",
}

_DEFAULT_SHAPE = "abstract emblem"
_DEFAULT_TONE_KEY = "미니얼하고 직관적인"


def _resolve_brand_name(survey: dict) -> str:
    return survey.get("brand_name") or survey.get("company_name") or "Brand"


def _resolve_colors(survey: dict, tone: str) -> str:
    manual = survey.get("color_manual") or survey.get("colors")
    if isinstance(manual, str):
        manual = [manual]
    if manual:
        return ", ".join(manual)
    return TONE_COLOR_FALLBACK_MAP.get(tone, "soft neutral tones")


def _resolve_values(survey: dict) -> str:
    raw = survey.get("brand_values") or survey.get("values") or []
    if isinstance(raw, str):
        raw = [raw]
    if not raw:
        return "quality, trust"
    return ", ".join(dict.fromkeys(VALUE_KEYWORD_MAP.get(v, v) for v in raw[:3]))


def _resolve_shape(survey: dict) -> str:
    categories = survey.get("motif_category") or []
    if isinstance(categories, str):
        categories = [categories]
    for cat in categories:
        if cat in MOTIF_SHAPE_MAP:
            return MOTIF_SHAPE_MAP[cat]
    return _DEFAULT_SHAPE


def _article_for(word: str) -> str:
    """모음으로 시작하면 'an', 아니면 'a'."""
    return "an" if word[:1].lower() in "aeiou" else "a"


def build_requirements(survey: dict) -> str:
    """설문 -> "Design ... Requirements:\n- 항목: 값 ..." 블록만 만든다.

    build_recraft_brief가 붙이는 서술형 문단 없이 이 블록만 필요한 호출부
    (예: 프론트 미리보기)를 위해 별도 함수로 뺐다.
    """
    brand_name = _resolve_brand_name(survey)
    industry_key = survey.get("industry", "")
    industry_label = INDUSTRY_LABEL_MAP.get(industry_key, "commercial")
    tone_key = survey.get("tone") or _DEFAULT_TONE_KEY
    tone_adjective = TONE_ADJECTIVE_MAP.get(tone_key, "modern")
    tone_desc = TONE_DESC_MAP.get(tone_key, "clean, balanced")
    colors = _resolve_colors(survey, tone_key)
    values = _resolve_values(survey)
    shape = _resolve_shape(survey)
    style = TONE_STYLE_MAP.get(tone_key, "clean, modern")
    return (
        f'Design {_article_for(tone_adjective)} {tone_adjective} {industry_label} brand logo for "{brand_name}". Requirements:\n'
        f'- Brand name: "{brand_name}"\n'
        f'- Brand values: {values}\n'
        f'- Tone: {tone_desc}\n'
        f'- Colors: {colors}\n'
        f'- Logo shape: {shape}\n'
        f'- Logo style: {style}\n\n'
    )


def build_recraft_brief(survey: dict) -> str:
    """설문 -> "requirements 목록 + 서술형 문단" 형식의 영문 프롬프트를 만든다."""
    brand_name = _resolve_brand_name(survey)
    tone_key = survey.get("tone") or _DEFAULT_TONE_KEY
    tone_desc = TONE_DESC_MAP.get(tone_key, "clean, balanced")
    industry_label = INDUSTRY_LABEL_MAP.get(survey.get("industry", ""), "commercial")
    colors = _resolve_colors(survey, tone_key)
    values = _resolve_values(survey)
    shape = _resolve_shape(survey)
    style = TONE_STYLE_MAP.get(tone_key, "clean, modern")
    requirements = build_requirements(survey)
    paragraph = (
        f"Create {_article_for(tone_desc)} {tone_desc.split(',')[0]} logo for "
        f"{_article_for(industry_label)} {industry_label} brand. "
        f"The mark should be {_article_for(shape)} {shape} that reflects {values.split(',')[0]}, "
        f"rendered in {_article_for(style)} {style} manner. The design has "
        f"{_article_for(colors)} {colors} color "
        f"palette. The logo should feel cohesive and intentional, suitable for "
        f"branding and brand identity. If typography is included, "
        f'it should clearly read as "{brand_name}".'
    )
    return requirements + paragraph
