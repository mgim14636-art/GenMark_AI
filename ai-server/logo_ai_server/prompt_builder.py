# 연령대·추가요구사항 같은 부가 설명만 예산이 남는 만큼 붙인다 (_fit_to_budget 참고).
NVIDIA_PROMPT_MAX_LEN = 800

TONE_MAP = {
    "친근하고 다정한": "a friendly, approachable feeling with gently rounded, soft shapes",
    "전문적이고 신뢰감 있는": "a professional, trustworthy feeling with structured, sharp geometric shapes",
    "감성적이고 따뜻한": "a delicate, warm, emotional feeling with organic hand-drawn curves",
    "유니크하고 트렌디한": "a bold, distinctive, trendy feeling with unconventional modern shapes",
    "미니얼하고 직관적인": "a clean, intuitive, minimal feeling using simple negative-space geometry",
}

# 톤별 디자인 미학 레퍼런스 — 실존 브랜드가 아닌 디자인 사조/스타일 클러스터를 참조시켜 퀄리티를 끌어올린다
TONE_AESTHETIC_MAP = {
    "친근하고 다정한": "soft Scandinavian-inspired friendly branding aesthetic",
    "전문적이고 신뢰감 있는": "corporate Swiss-style minimalist branding aesthetic",
    "감성적이고 따뜻한": "warm Japanese wabi-sabi inspired branding aesthetic",
    "유니크하고 트렌디한": "bold contemporary Gen-Z streetwear branding aesthetic",
    "미니얼하고 직관적인": "clean Bauhaus-inspired minimalist branding aesthetic",
}

# 톤 선택 시 화면(FR-09)에 자동 매핑되는 AI 추천 색상 팔레트
TONE_COLOR_MAP = {
    "친근하고 다정한": "soft pink and light sky blue",
    "전문적이고 신뢰감 있는": "deep navy and dusty rose",
    "감성적이고 따뜻한": "warm terracotta brown and cream ivory",
    "유니크하고 트렌디한": "bold black and pale grey",
    "미니얼하고 직관적인": "clean cobalt blue and pale sky blue",
}

# 구버전 설문 응답 키(하위 호환) — TONE_MAP/TONE_AESTHETIC_MAP/TONE_COLOR_MAP 세 곳에
# 매번 같은 문구를 중복 입력하지 않도록 별칭만 따로 두고, build_prompt_from_survey
# 진입 시 한 번만 정규화한다.
_LEGACY_TONE_ALIASES = {
    "친근함": "친근하고 다정한",
    "전문성": "전문적이고 신뢰감 있는",
    "감성": "감성적이고 따뜻한",
    "미니멀": "미니얼하고 직관적인",
}


def _normalize_tone(tone: str) -> str:
    return _LEGACY_TONE_ALIASES.get(tone, tone)


# 스타일별 심볼 문장 — 브랜드명 문자는 절대 넣지 않는다(항상 logo_composer.py가 합성).
STYLE_MAP = {
    "심볼": "The mark is a purely graphic, abstract symbol icon with no letterforms.",
    "워드마크": "The mark is an abstract shape inspired by wordmark letterforms, without any readable text.",
    "혼합형": "The mark combines a graphic symbol with an abstract letterform-like silhouette.",
    "레터마크": "The mark is an elegant monogram-style abstract initial shape, without any readable text.",
}

# MVP 범위는 뷰티(G1201) 한정 — 다른 업종은 아직 구현하지 않아 목록에서 제외
INDUSTRY_MAP = {
    "뷰티": "a beauty and cosmetics brand",
    "기타": "a general commercial brand",
}

# 업종별 구체적 비주얼 모티프 후보(넓은 풀) — 잎사귀·물방울 같은 몇 개로 한정되지 않도록
# 후보를 넉넉히 늘려두고, 실제 선택은 _resolve_motif가 브랜드명·선택한 가치 키워드를
# 반영해 매번 다른 부분집합에서 고르게 한다 (다양성 확보 핵심 장치).
MOTIF_MAP = {
    "뷰티": [
        "a single botanical leaf silhouette",
        "a water droplet shape",
        "an abstract flower petal",
        "a minimal cosmetic bottle silhouette",
        "a radiant glow/sunburst shape",
        "an abstract gem facet shape",
        "a crescent moon curve",
        "a spiraling ribbon shape",
        "a soft wave curve",
        "an orbiting ring shape",
        "a blooming blossom cluster",
        "a feather silhouette",
        "a seashell spiral",
        "an infinity loop shape",
        "a mountain peak silhouette",
        "a star burst shape",
    ],
    "기타": [
        "an abstract geometric emblem",
        "a minimal circular badge shape",
        "an abstract dynamic swoosh",
        "a balanced triangular emblem",
        "a spiraling ribbon shape",
        "an orbiting ring shape",
        "a star burst shape",
        "an infinity loop shape",
    ],
}

# 가치 키워드별로 잘 어울리는 모티프를 우선 후보로 끌어올린다 — "프리미엄"을 고르면
# 보석/글로우 계열이, "자연주의"를 고르면 식물 계열이 우선 반영되는 식으로, 선택한
# 가치와 무관하게 아무 모티프나 고정 순환하지 않도록 한다.
VALUE_MOTIF_BIAS = {
    "비건": ["a single botanical leaf silhouette", "a blooming blossom cluster"],
    "자연주의": ["a single botanical leaf silhouette", "a blooming blossom cluster", "a mountain peak silhouette"],
    "클린뷰티": ["a water droplet shape", "a soft wave curve"],
    "고보습": ["a water droplet shape", "a soft wave curve"],
    "프리미엄": ["an abstract gem facet shape", "a radiant glow/sunburst shape", "a star burst shape"],
    "한방·전통": ["a spiraling ribbon shape", "a seashell spiral"],
    "트렌디": ["a star burst shape", "an orbiting ring shape"],
    "감성적": ["a crescent moon curve", "a feather silhouette"],
    "지속가능": ["a single botanical leaf silhouette", "an infinity loop shape"],
}

# CI 화면(FR-08)의 "기업 가치·방향성" 키워드 칩 (뷰티 업종, 최대 3개 선택)
VALUE_KEYWORD_MAP = {
    "비건": "vegan",
    "크루얼티프리": "cruelty-free",
    "더마·저자극": "dermatologically gentle, low-irritation",
    "클린뷰티": "clean beauty",
    "자연주의": "naturalistic, botanical",
    "데일리": "everyday daily-use",
    "프리미엄": "premium, luxurious",
    "지속가능": "sustainable, eco-friendly",
    "한방·전통": "traditional herbal heritage",
    "과학적 검증": "clinical, science-backed",
    "가성비": "affordable, practical value",
    "트렌디": "trendy, on-trend",
    "심플": "simple",
    "고보습": "hydrating, moisture-rich",
    "감성적": "emotional, sensory",
}

TARGET_AGE_MODIFIER = {
    "10-20대": "a youthful, playful character",
    "30-40대": "a modern, confident character",
    "40-50대": "a refined, reliable character",
    "50-60대": "a classic, dependable character",
    "전 연령": "a universally approachable character",
}


def _resolve_industry(industry: str) -> str:
    return INDUSTRY_MAP.get(industry, INDUSTRY_MAP["기타"])


def _resolve_tone(tone: str) -> str:
    return TONE_MAP.get(tone, "")


def _raw_value_keys(survey: dict) -> list:
    """'기업 가치·방향성' 키워드 칩의 원본 키(번역 전) 목록. 최대 3개."""
    raw_values = survey.get("brand_values") or survey.get("values")
    if isinstance(raw_values, str):
        raw_values = [raw_values]
    return list(raw_values or [])[:3]


def _resolve_values(survey: dict) -> str:
    """'기업 가치·방향성' — 키워드 칩(최대 3개) 또는 서술형 자유 입력을 모두 지원."""
    raw_values = _raw_value_keys(survey)
    if raw_values:
        translated = [VALUE_KEYWORD_MAP.get(v, v) for v in raw_values]
        joined = ", ".join(dict.fromkeys(translated))  # 순서 보존 중복 제거
        return f"The brand values are {joined}."

    # 서술형(자유 텍스트) 입력 — 키워드 매핑 없이 그대로 보조 컨텍스트로 사용
    free_text = survey.get("brand_values_text") or survey.get("brand_description")
    if free_text:
        return free_text.strip()[:200]
    return ""


def _resolve_motif(industry_key: str, survey: dict, variant_index: int) -> str:
    """모티프를 브랜드명·선택한 가치 키워드에 따라 유동적으로 고른다.

    업종 고정 목록을 그냥 순환하는 대신, 선택한 가치 키워드(VALUE_MOTIF_BIAS)에 해당하는
    모티프를 후보 앞쪽으로 끌어올려 우선 반영하고, 브랜드명 문자열을 섞은 값으로 골라서
    같은 업종·같은 톤이라도 브랜드명이 다르면 다른 모티프 조합이 나오게 한다.
    """
    pool = MOTIF_MAP.get(industry_key, MOTIF_MAP["기타"])
    biased = []
    for key in _raw_value_keys(survey):
        for motif in VALUE_MOTIF_BIAS.get(key, []):
            if motif in pool and motif not in biased:
                biased.append(motif)
    candidates = biased + [m for m in pool if m not in biased] if biased else pool

    brand_name = (survey.get("brand_name") or "").strip().lower()
    offset = sum(ord(c) for c in brand_name) if brand_name else 0
    return candidates[(offset + variant_index) % len(candidates)]


def _resolve_colors(survey: dict, tone: str) -> str:
    """색상: AI 추천(톤 기반 자동 매핑) 또는 사용자 직접 지정."""
    color_mode = survey.get("color_mode", "ai")
    if color_mode == "manual":
        manual_colors = survey.get("color_manual") or survey.get("colors")
        if isinstance(manual_colors, str):
            manual_colors = [manual_colors]
        if manual_colors:
            return ", ".join(manual_colors)
    return TONE_COLOR_MAP.get(tone, "pastel muted tones")


def _fit_to_budget(core: str, optional_parts: list) -> str:
    """core는 절대 자르지 않고, optional_parts를 예산이 허용하는 만큼만 순서대로 덧붙인다.

    NVIDIA API가 prompt 길이를 제한(NVIDIA_PROMPT_MAX_LEN, 초과 시 422)하기 때문에, 끝에서부터
    무작정 슬라이싱하면 가장 중요한 품질/형태 지시(core)가 잘려나갈 위험이 있다. 대신 core를
    먼저 확정하고, 톤·미학·가치·연령대·추가요구사항 같은 부가 설명은 예산이 허용하는 동안만
    하나씩 붙인다 — 부족하면 뒤쪽(덜 중요한 것)부터 자연스럽게 생략된다.
    """
    prompt = core
    for part in optional_parts:
        if not part:
            continue
        candidate = f"{prompt} {part}"
        if len(candidate) <= NVIDIA_PROMPT_MAX_LEN:
            prompt = candidate
        else:
            break
    return prompt[:NVIDIA_PROMPT_MAX_LEN]


def _normalize_survey(survey: dict) -> dict:
    """CI/BI 화면(설문 1/5)마다 다른 필드명을 build_prompt_from_survey가 쓰는 공통
    키(brand_name/brand_values/brand_values_text)로 맞춘다.

    - BI 화면: brand_name(브랜드명), brand_direction(브랜드 방향성·핵심 편익, 서술형),
      target_age(주요 타겟 연령대)
    - CI 화면: company_name(상호명), company_values(기업 가치 키워드 최대 3개) 또는
      company_values_text(서술형)

    이미 공통 키로 들어온 값은 그대로 두고(설문 화면 없이 직접 테스트하는 경우 대비),
    survey.get("ci_bi")가 "CI"일 때만 상호명/기업가치 쪽 필드를 함께 봐준다.
    """
    survey = dict(survey)
    if survey.get("ci_bi") == "CI":
        survey.setdefault("brand_name", survey.get("company_name"))
        if survey.get("company_values") is not None:
            survey.setdefault("brand_values", survey.get("company_values"))
        if survey.get("company_values_text") is not None:
            survey.setdefault("brand_values_text", survey.get("company_values_text"))
    elif survey.get("brand_direction") is not None:
        survey.setdefault("brand_values_text", survey.get("brand_direction"))
    return survey


def build_prompt_from_survey(survey: dict, variant_index: int = 0) -> str:
    """설문을 프롬프트로 변환한다.

    survey는 화면설계서의 CI/BI 화면 필드명(company_name/company_values 등)을 그대로
    넘겨도 되고, 이미 정규화된 공통 키(brand_name/brand_values)를 넘겨도 된다 —
    내부에서 _normalize_survey가 자동으로 맞춰준다.

    variant_index: 동일 설문으로 여러 시안을 생성할 때 0, 1, 2, 3...으로 다르게 넘기면
    시안마다 다른 비주얼 모티프가 배정되어, 랜덤 시드 차이에만 의존하지 않고 실제
    형태 아이디어가 달라진 다양한 시안을 얻을 수 있다.

    프롬프트는 FLUX.2 Klein(Qwen 텍스트 인코더)에 맞춰 완전한 문장으로 조립한다.
    콤마로 나열하는 키워드 태그 방식(SD1.5/SDXL 스타일)이나 "no gradient / no text"
    같은 부정문 나열은 이 모델에서 잘 작동하지 않거나 역효과를 낼 수 있어 사용하지 않는다.
    """
    survey = _normalize_survey(survey)
    style_key = survey.get("style", "")
    industry_key = survey.get("industry", "")
    industry = _resolve_industry(industry_key)
    tone = _normalize_tone(survey.get("tone", ""))
    tone_kw = _resolve_tone(tone)
    aesthetic_kw = TONE_AESTHETIC_MAP.get(tone, "")
    color_kw = _resolve_colors(survey, tone)
    value_kw = _resolve_values(survey)
    age_kw = TARGET_AGE_MODIFIER.get(survey.get("target_age", ""), "")
    motif_kw = _resolve_motif(industry_key, survey, variant_index)
    style_sentence = STYLE_MAP.get(style_key, STYLE_MAP["심볼"])

    extra = (survey.get("additional_requirements") or "").strip()
    extra = " ".join(extra.split())[:200]  # 개행 제거 및 과도한 길이 방지

    # core: 반드시 포함돼야 하는 핵심 지시(업종/스타일/색상/모티프+형태 품질/텍스트 배제
    # 규칙)를 완전한 문장으로 서술한다. 모티프(가장 중요한 정보)를 맨 앞에 배치해
    # 모델이 우선적으로 주목하게 하고, "선이 끊긴다"·"도형이 너무 작다" 문제를 해결했던
    # 지시(fills most of the canvas, unbroken outline)도 core 안에 자연스러운 문장으로
    # 녹여 예산 초과로도 잘리지 않게 한다.
    core = (
        f"A minimalist flat vector logo icon for {industry}, drawn as one bold, large, "
        f"solid-filled silhouette in {motif_kw}, with a thick, clean, fully unbroken outline "
        f"that fills most of the canvas. {style_sentence} "
        f"The design has {tone_kw or 'a clean, balanced'} character. "
        f"It uses solid flat colors in a {color_kw} palette, rendered as simple two-dimensional "
        f"shapes with no gradients, no shadows, and no photographic or 3D rendering. "
        f"The icon is centered on a plain white background, with no readable letters or words "
        f"anywhere in the image, finished and complete rather than a rough sketch."
    )

    # 부가 설명은 예산이 남는 만큼만 순서대로 붙인다. value_kw(사용자가 직접 고른 기업
    # 가치)는 다른 곳에 안 나오는 유일한 정보라 최우선으로 두고, aesthetic_kw는 tone에서
    # 파생돼 겹치는 정보가 많아 뒤로 미뤄도 손실이 적다.
    optional_parts = [
        value_kw,
        f"Its target audience has {age_kw}." if age_kw else "",
        f"The overall style references a {aesthetic_kw}." if aesthetic_kw else "",
        extra,
    ]
    return _fit_to_budget(core, optional_parts)