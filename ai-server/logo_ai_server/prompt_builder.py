# 화면설계서(FR-05~FR-14) 설문 항목과 1:1로 매핑된 프롬프트 빌더.
# 브랜드명(FR-07 "브랜드명(로고에 표시)")은 기본적으로 심볼 스타일에서는 이미지에 넣지 않고
# 별도 폰트 레이어 합성으로 처리하지만(문자 렌더링 오류 회피), 워드마크·레터마크 스타일이거나
# 사용자가 명시적으로 텍스트 포함을 선택한 경우에는 브랜드명을 프롬프트에 직접 포함시킨다.

TONE_MAP = {
    "친근하고 다정한": "friendly, approachable, warm and soft impression, gently rounded shapes",
    "전문적이고 신뢰감 있는": "professional, trustworthy, structured and confident impression, sharp geometric shapes",
    "감성적이고 따뜻한": "emotional, delicate and warm impression, organic hand-drawn curves",
    "유니크하고 트렌디한": "unique, trendy, bold and distinctive impression, unconventional modern shapes",
    "미니얼하고 직관적인": "minimal, intuitive, clean and uncluttered impression, simple negative-space geometry",
    # 구버전 키(하위 호환)
    "친근함": "friendly, approachable, warm and soft impression, gently rounded shapes",
    "전문성": "professional, trustworthy, structured and confident impression, sharp geometric shapes",
    "감성": "emotional, delicate and warm impression, organic hand-drawn curves",
    "미니멀": "minimal, intuitive, clean and uncluttered impression, simple negative-space geometry",
}

# 톤별 디자인 미학 레퍼런스 — 실존 브랜드가 아닌 디자인 사조/스타일 클러스터를 참조시켜 퀄리티를 끌어올린다
TONE_AESTHETIC_MAP = {
    "친근하고 다정한": "soft Scandinavian-inspired friendly branding aesthetic",
    "전문적이고 신뢰감 있는": "corporate Swiss-style minimalist branding aesthetic",
    "감성적이고 따뜻한": "warm Japanese wabi-sabi inspired branding aesthetic",
    "유니크하고 트렌디한": "bold contemporary Gen-Z streetwear branding aesthetic",
    "미니얼하고 직관적인": "clean Bauhaus-inspired minimalist branding aesthetic",
    "친근함": "soft Scandinavian-inspired friendly branding aesthetic",
    "전문성": "corporate Swiss-style minimalist branding aesthetic",
    "감성": "warm Japanese wabi-sabi inspired branding aesthetic",
    "미니멀": "clean Bauhaus-inspired minimalist branding aesthetic",
}

# 톤 선택 시 화면(FR-09)에 자동 매핑되는 AI 추천 색상 팔레트
TONE_COLOR_MAP = {
    "친근하고 다정한": "soft pink and light sky blue tones",
    "전문적이고 신뢰감 있는": "deep navy and dusty rose tones",
    "감성적이고 따뜻한": "warm terracotta brown and cream ivory tones",
    "유니크하고 트렌디한": "bold black and pale grey tones",
    "미니얼하고 직관적인": "clean cobalt blue and pale sky blue tones",
    "친근함": "soft pink and light sky blue tones",
    "전문성": "deep navy and dusty rose tones",
    "감성": "warm terracotta brown and cream ivory tones",
    "미니멀": "clean cobalt blue and pale sky blue tones",
}

# 브랜드명 텍스트를 이미지에 넣지 않는 경우(기본값, 심볼 스타일 등) — 폰트 레이어 합성을 위해 도형만 생성
STYLE_MAP = {
    "심볼": "abstract symbol icon, purely graphic mark, no letters",
    "워드마크": "typographic wordmark-style layout, letterform-inspired abstract shapes, no readable text",
    "혼합형": "symbol combined with an abstract letterform silhouette",
    "레터마크": "monogram-style abstract initial shape, elegant typographic mark, no readable text",
}

# 브랜드명 텍스트를 이미지에 직접 포함하는 경우 — 워드마크/레터마크 본연의 목적대로 실제 글자를 렌더링
STYLE_MAP_WITH_TEXT = {
    "워드마크": "wordmark logo layout, the brand name as the central typographic design element",
    "혼합형": "symbol icon paired with the brand name rendered as a wordmark beside or below it",
    "레터마크": "lettermark / monogram logo built from the brand name's initials",
}

# MVP 범위는 뷰티(G1201) 한정 — 다른 업종은 아직 구현하지 않아 목록에서 제외
INDUSTRY_MAP = {
    "뷰티": "beauty and cosmetics industry, skincare and makeup brand",
    "기타": "general commercial brand",
}

# 업종별 구체적 비주얼 모티프 후보 — 시안(variant)마다 다른 모티프를 배정해 4개 시안이
# 시드 차이만이 아니라 실제 형태 아이디어 자체가 달라지도록 한다 (다양성 확보 핵심 장치)
MOTIF_MAP = {
    "뷰티": [
        "a single botanical leaf silhouette",
        "a water droplet shape",
        "an abstract flower petal",
        "a minimal cosmetic bottle silhouette",
        "a radiant glow/sunburst shape",
        "an abstract gem facet shape",
    ],
    "기타": [
        "an abstract geometric emblem",
        "a minimal circular badge shape",
        "an abstract dynamic swoosh",
        "a balanced triangular emblem",
    ],
}

# 항상 모든 스타일/품질절에 붙는 전문 로고 디자인 품질 앵커 어휘
QUALITY_BOOST_CLAUSE = (
    "award-winning brand identity design, iconic and memorable mark, "
    "balanced negative space, professional studio-quality graphic design, "
    "clean scalable icon that stays legible at small sizes"
)

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

# 로고 스타일에 관계 없이 항상 적용되는 디자인 규칙(품질/구성 고정 절) — 텍스트 미포함 버전
NO_TEXT_QUALITY_CLAUSE = (
    "flat 2D vector logo design, single clean silhouette, solid flat colors, "
    "no gradient noise, no photorealism, no 3D render, no drop shadow, no mockup, "
    "no watermark, no signature, no text, no letters, no typography, "
    "centered composition, isolated on a plain white background, print-ready vector art, "
    f"{QUALITY_BOOST_CLAUSE}"
)

# 브랜드명 텍스트를 포함하는 버전 — "no text/no letters"를 빼고 타이포그래피 품질 가드를 넣는다
TEXT_QUALITY_CLAUSE = (
    "flat 2D vector logo design, solid flat colors, no gradient noise, no photorealism, "
    "no 3D render, no drop shadow, no mockup, no watermark, no signature, "
    "centered composition, isolated on a plain white background, print-ready vector art, "
    "sharp crisp bold typography, no blurry text, no distorted or gibberish letters, "
    f"{QUALITY_BOOST_CLAUSE}"
)

TARGET_AGE_MODIFIER = {
    "10-20대": "youthful and playful character",
    "30-40대": "modern and confident character",
    "40-50대": "refined and reliable character",
    "50-60대": "classic and dependable character",
    "전 연령": "universally approachable character",
}


def _should_render_text(survey: dict, style_key: str) -> bool:
    """브랜드명 텍스트를 이미지에 직접 넣을지 여부.

    심볼 스타일은 정의상 텍스트가 없으므로 항상 False. 그 외에는 사용자가
    명시적으로 응답한 텍스트 포함 여부(설문 토글)를 우선하고, 응답이 없으면
    워드마크·레터마크 스타일일 때 기본적으로 텍스트를 포함한다.
    """
    if style_key == "심볼":
        return False

    explicit = survey.get("include_brand_name_in_logo")
    if explicit is None:
        explicit = survey.get("show_text_in_logo")
    if explicit is not None:
        return bool(explicit)

    return style_key in ("워드마크", "레터마크", "혼합형")


def _brand_name_clause(survey: dict) -> str:
    """FR-07 '브랜드명(로고에 표시)' 입력값을 프롬프트에 넣을 문구로 변환."""
    name = (survey.get("brand_name") or "").strip()
    if not name:
        return ""
    name = " ".join(name.split()).replace('"', "'")[:30]
    return (
        f'the brand name "{name}" rendered directly in the logo as its typography, '
        f"correctly spelled, no extra or missing characters"
    )


def _resolve_style(style_key: str, include_text: bool) -> str:
    if include_text:
        return STYLE_MAP_WITH_TEXT.get(style_key, STYLE_MAP.get(style_key, STYLE_MAP["심볼"]))
    return STYLE_MAP.get(style_key, STYLE_MAP["심볼"])


def _resolve_industry(industry: str) -> str:
    return INDUSTRY_MAP.get(industry, INDUSTRY_MAP["기타"])


def _resolve_tone(tone: str) -> str:
    return TONE_MAP.get(tone, "")


def _resolve_values(survey: dict) -> str:
    """'기업 가치·방향성' — 키워드 칩(최대 3개) 또는 서술형 자유 입력을 모두 지원."""
    raw_values = survey.get("brand_values") or survey.get("values")
    if isinstance(raw_values, str):
        raw_values = [raw_values]
    if raw_values:
        translated = [VALUE_KEYWORD_MAP.get(v, v) for v in raw_values[:3]]
        return ", ".join(dict.fromkeys(translated))  # 순서 보존 중복 제거

    # 서술형(자유 텍스트) 입력 — 키워드 매핑 없이 그대로 보조 컨텍스트로 사용
    free_text = survey.get("brand_values_text") or survey.get("brand_description")
    if free_text:
        return free_text.strip()[:200]
    return ""


def _resolve_motif(industry_key: str, variant_index: int) -> str:
    """시안(variant)마다 다른 모티프를 배정해 4개 시안의 형태 아이디어 자체를 다르게 만든다."""
    motifs = MOTIF_MAP.get(industry_key, MOTIF_MAP["기타"])
    return motifs[variant_index % len(motifs)]


def _resolve_colors(survey: dict, tone: str) -> str:
    """색상: AI 추천(톤 기반 자동 매핑) 또는 사용자 직접 지정."""
    color_mode = survey.get("color_mode", "ai")
    if color_mode == "manual":
        manual_colors = survey.get("color_manual") or survey.get("colors")
        if isinstance(manual_colors, str):
            manual_colors = [manual_colors]
        if manual_colors:
            return f"{', '.join(manual_colors)} color palette"
    return f"{TONE_COLOR_MAP.get(tone, 'pastel muted tones')} color palette"


# NVIDIA flux.2-klein-4b가 실제로 거부하는 프롬프트 길이 상한(undocumented — 공식 스펙 문서는
# 10000자라고 되어 있지만 라이브 엔드포인트는 800자를 넘으면 422 string_too_long을 반환한다).
MAX_PROMPT_CHARS = 800


def build_prompt_from_survey(survey: dict, variant_index: int = 0) -> str:
    """설문을 프롬프트로 변환한다.

    variant_index: 동일 설문으로 여러 시안을 생성할 때 0, 1, 2, 3...으로 다르게 넘기면
    시안마다 다른 비주얼 모티프가 배정되어, 랜덤 시드 차이에만 의존하지 않고 실제
    형태 아이디어가 달라진 다양한 시안을 얻을 수 있다.
    """
    style_key = survey.get("style", "")
    industry_key = survey.get("industry", "")
    industry = _resolve_industry(industry_key)
    tone = survey.get("tone", "")
    tone_kw = _resolve_tone(tone)
    aesthetic_kw = TONE_AESTHETIC_MAP.get(tone, "")
    color_kw = _resolve_colors(survey, tone)
    value_kw = _resolve_values(survey)
    age_kw = TARGET_AGE_MODIFIER.get(survey.get("target_age", ""), "")
    motif_kw = _resolve_motif(industry_key, variant_index)

    include_text = _should_render_text(survey, style_key)
    brand_name_clause = _brand_name_clause(survey) if include_text else ""
    include_text = include_text and bool(brand_name_clause)  # 이름 미입력 시 텍스트 포함 취소

    style = _resolve_style(style_key, include_text)
    quality_clause = TEXT_QUALITY_CLAUSE if include_text else NO_TEXT_QUALITY_CLAUSE

    extra = (survey.get("additional_requirements") or "").strip()
    extra = " ".join(extra.split())[:200]  # 개행 제거 및 과도한 길이 방지

    # (우선순위, 문구) — 원래 순서는 그대로 유지하되, 800자를 넘으면 우선순위가 낮은
    # (숫자가 큰) 절부터 통째로 제거한다. 문장 중간을 잘라내면 "no text"/"correctly
    # spelled" 같은 가드 문구가 잘려나가 오히려 품질이 나빠질 수 있어 절 단위로만 줄인다.
    tagged_parts = [
        (1, f"a logo mark for a {industry}"),
        (1, style),
        (1, f"subtly evoking {motif_kw}"),
        (1, brand_name_clause),
        (2, tone_kw),
        (4, aesthetic_kw),
        (5, value_kw),
        (6, age_kw),
        (2, color_kw),
        (7, quality_clause),
    ]
    if extra:
        tagged_parts.append((3, extra))

    tagged_parts = [(priority, text) for priority, text in tagged_parts if text]

    def _assemble(items):
        return ", ".join(text for _, text in items)

    prompt = _assemble(tagged_parts)
    for drop_priority in (6, 5, 4, 3):
        if len(prompt) <= MAX_PROMPT_CHARS:
            break
        tagged_parts = [(p, t) for p, t in tagged_parts if p != drop_priority]
        prompt = _assemble(tagged_parts)

    return prompt[:MAX_PROMPT_CHARS]