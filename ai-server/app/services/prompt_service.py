"""설문 -> 이미지 생성 프롬프트 조립.

핵심 지시(core)는 항상 포함하고, 연령대·추가요구사항 같은 부가 설명만 예산이
남는 만큼 붙인다 (_fit_to_budget 참고).
"""
import os
import re

# 프롬프트 길이 예산.
# 800자는 NVIDIA Build 엔드포인트의 제한이었다(초과 시 422). OpenRouter Image API로
# 옮긴 뒤로는 그 제한이 없는데 값이 그대로 남아, 톤·미학·가치 설명이 예산 부족으로
# 조용히 잘려나가고 있었다. 넉넉히 올리되 무한정 늘리지는 않는다 — 프롬프트가 길수록
# 개별 지시의 반영 강도가 희석된다.
PROMPT_MAX_LEN = int(os.environ.get("PROMPT_MAX_LEN", "1400"))

# 이전 이름을 참조하는 코드가 남아 있을 수 있어 별칭을 유지한다.

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

_CURRENT_SURVEY_ALIASES = {
    "industry": {
        "COSMETICS": "뷰티",
        "FASHION": "기타",
        "FOOD": "기타",
        "TECH": "기타",
        "HEALTH_WELLNESS": "기타",
        "OTHER": "기타",
    },
    "tone": {
        "friendly": "친근하고 다정한",
        "professional": "전문적이고 신뢰감 있는",
        "warm": "감성적이고 따뜻한",
        "trendy": "유니크하고 트렌디한",
        "minimal": "미니얼하고 직관적인",
    },
    "style": {
        "symbol": "심볼",
        "wordmark": "워드마크",
        "combination": "혼합형",
        "lettermark": "레터마크",
    },
    "target_age": {
        "10-20": "10-20대",
        "20-30": "20-30대",
        "30-40": "30-40대",
        "40-50": "40-50대",
        "50-60": "50-60대",
        "ALL": "전 연령",
        "ALL_AGES": "전 연령",
        # 화면(App.tsx)과 DB 기본값(bi_project.target_age)이 쓰는 실제 문자열은
        # "전 연령층"이다. TARGET_AGE_MODIFIER 키가 "전 연령"이라 여태 매칭되지
        # 않아, 이 값을 고른 사용자는 타겟 정보가 프롬프트에서 통째로 빠졌다.
        "전 연령층": "전 연령",
    },
}

# 브랜드 가치 칩 — 프론트가 보내는 값과 우리 사전 키가 서로 다르다.
#
#   App.tsx      type CoreValue = 'vegan' | 'lowIrritation' | ...   (영문 id)
#   genmarkApi   valueCategory1 = input.brandValues[0]              (그대로 전달)
#   BiProject    survey["brand_values"]                             (그대로 전달)
#   여기         VALUE_KEYWORD_MAP = { "비건": ..., "클린뷰티": ... }  (한글 키)
#
# 그래서 9개 칩이 전부 매칭에 실패했고, VALUE_KEYWORD_MAP.get(v, v)가 원본을
# 돌려주는 바람에 "The brand values are vegan, lowIrritation." 처럼 영문 id가
# 그대로 프롬프트에 실렸다. VALUE_MOTIF_BIAS도 같은 이유로 한 건도 잡히지 않았다.
#
# 화면 라벨(한글)로 들어오는 경우도 함께 받아둔다 — 프론트가 라벨을 보내도록
# 바뀌어도 깨지지 않게 하기 위함이다.
_VALUE_ALIASES = {
    "vegan": "비건",
    "lowIrritation": "더마·저자극",
    "derma": "더마·저자극",
    "cleanBeauty": "클린뷰티",
    "natural": "자연주의",
    "premium": "프리미엄",
    "sustainable": "지속가능",
    "scientific": "과학적 검증",
    "reasonable": "가성비",
    # 화면 라벨 그대로 들어오는 경우 (사전 키와 표기가 다른 것만)
    "저자극": "더마·저자극",
    "더마": "더마·저자극",
    "지속가능성": "지속가능",
    "합리적인 가격": "가성비",
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

# 카테고리를 고르지 않았을 때 MOTIF_MAP의 고정 목록을 쓸 업종.
# "기타"는 별·무한대·링처럼 상투적인 도형만 있어 강제하면 오히려 밋밋해진다
# (94062ed에서 열린 지시로 바꾼 이유). 뷰티 풀은 업종 특화 모티프라 강제해도 좋다.
MOTIF_POOL_INDUSTRIES = {"뷰티"}

USER_MOTIF_RENDERING_APPROACHES = (
    "a bold simplified flat silhouette",
    "soft organic abstract contours",
    "a clever negative-space construction",
    "a balanced abstract composition",
)

# 설문 화면(FR-06)의 "모티프 카테고리" 칩 — 사용자가 이걸 고르면 업종 고정 목록
# (MOTIF_MAP) 대신 이 목록에서 모티프를 고른다. 예전엔 이 필드가 코드에서 아예 읽히지
# 않아서 "동물/생명체"·"기하학적 도형"을 골라도 항상 잎사귀·물방울 같은 보태니컬
# 모티프만 나오는 문제가 있었다(실측 확인됨).
MOTIF_CATEGORY_MAP = {
    "동물/생명체": [
        "a stylized butterfly silhouette",
        "an abstract bird in flight",
        "a graceful swan curve",
        "a leaping fox silhouette",
        "a phoenix-like wing shape",
        "a coiled serpent curve",
    ],
    "기하학적 도형": [
        "an angular faceted polygon shape",
        "an abstract hexagonal emblem",
        "interlocking geometric rings",
        "a sharp triangular prism shape",
        "an abstract cube facet shape",
        "a bold zigzag emblem",
    ],
    "원형/깔끔함": [
        "a perfect circular badge shape",
        "a clean minimal ring/halo shape",
        "a smooth orbital circle",
        "a simple circular seal shape",
    ],
    "보석/빛": [
        "an abstract gem facet shape",
        "a radiant glow/sunburst shape",
        "a faceted crystal shape",
        "a sparkling star burst shape",
    ],
}

# 설문 화면의 "구체성" 칩 — 모티프를 얼마나 사실적으로 그릴지 지시한다. 이 지시가
# 없으면 모델이 임의로 구체성 수준을 정해서, "완전 추상"을 골라도 사실적인 코스메틱
# 병 그림이 나오는 등 의도와 다른 결과가 나올 수 있다(실측 확인됨).
CONCRETENESS_MAP = {
    "완전 추상": "purely abstract and non-representational, not a literal recognizable object",
    "적당히 단순화": "simplified into clean geometric shapes, while still recognizable as its subject",
    "사실적": "clearly recognizable and representational, close to the real subject",
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
    # 화면의 9개 칩 중 아래 셋은 대응 모티프가 없어 가치를 골라도 모티프가
    # 비었다. 나머지 칩과 결이 맞는 후보를 채운다.
    "더마·저자극": ["a water droplet shape", "a soft wave curve"],
    "과학적 검증": ["an abstract gem facet shape", "a star burst shape"],
    "가성비": ["a soft wave curve", "an orbiting ring shape"],
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
    "20-30대": "a youthful, modern character",
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


_HANGUL = re.compile(r"[가-힣]")


def _resolve_values(survey: dict) -> str:
    """'기업 가치·방향성' — 키워드 칩(최대 3개) 또는 서술형 자유 입력을 모두 지원.

    서술형은 예전에 원문을 그대로 이어 붙였다. 그 결과 영문 프롬프트 한복판에
    "... rather than a sketch. 신뢰, 혁신 The overall style ..." 처럼 한글 조각이
    문장 없이 박혔다(실측 확인됨). 텍스트 인코더에는 노이즈일 뿐이라, 아는 키워드는
    영어로 바꾸고 남은 한글은 버린다. 전부 한글이면 이 문장 자체를 생략한다.
    """
    raw_values = _raw_value_keys(survey)
    if raw_values:
        translated = [VALUE_KEYWORD_MAP.get(v, v) for v in raw_values]
        joined = ", ".join(dict.fromkeys(translated))  # 순서 보존 중복 제거
        return f"The brand values are {joined}."

    free_text = (
        survey.get("brand_values_text") or survey.get("brand_description") or ""
    ).strip()[:200]
    if not free_text:
        return ""

    # 쉼표·중점으로 끊어 토큰 단위로 번역을 시도한다("신뢰, 혁신" -> 각각 조회).
    tokens = [t.strip() for t in re.split(r"[,،·/]|、", free_text) if t.strip()]
    usable = []
    for t in tokens:
        mapped = VALUE_KEYWORD_MAP.get(t)
        if mapped:
            usable.append(mapped)
        elif not _HANGUL.search(t):
            usable.append(t)  # 이미 영문으로 적혀 있으면 그대로 쓴다
    if not usable:
        return ""
    return f"The brand values are {', '.join(dict.fromkeys(usable))}."


def _raw_motif_categories(survey: dict) -> list:
    """설문 화면(FR-06)의 '모티프 카테고리' 칩 원본 값 목록(복수 선택 가능)."""
    raw = survey.get("motif_category")
    if isinstance(raw, str):
        raw = [raw]
    return list(raw or [])


def _resolve_motif(industry_key: str, survey: dict, variant_index: int) -> str:
    """모티프를 고른다.

    motif_category(사용자가 직접 고른 모티프 카테고리 칩, 예: "동물/생명체",
    "기하학적 도형")가 있으면 MOTIF_CATEGORY_MAP에서 그 카테고리에 해당하는 후보만
    쓴다 — 업종 고정 목록(MOTIF_MAP)은 사용자가 카테고리를 아예 지정하지 않았을 때만
    쓰는 기본값이다. 이전에는 motif_category를 아예 읽지 않아서 "동물/생명체"를
    골라도 항상 업종 고정 보태니컬 모티프(잎사귀·물방울 등)만 나왔다(실측 확인됨).

    카테고리를 고르지 않았을 때의 동작은 업종에 따라 다르다.

    - 뷰티: MOTIF_MAP["뷰티"]의 구체 모티프(잎사귀·물방울·꽃잎·초승달 등 16종)를
      순환 배정한다. 열린 지시만 주면 모델이 매번 비슷한 추상 도형으로 수렴해
      시안 4장이 사실상 같아 보이는 문제가 있었다(실측 확인됨).
    - 그 외 업종: 열린 지시를 유지한다. MOTIF_MAP["기타"]는 별·무한대·링처럼
      로고에서 흔히 쓰이는 상투적 도형이라, 이를 강제하지 않기로 한 기존 판단
      (94062ed, test_default_variants_do_not_force_fixed_fallback_shapes)을 그대로 둔다.

    MVP 범위가 뷰티 한정이므로 실제 서비스 경로는 위쪽이다.
    """
    extra = " ".join((survey.get("additional_requirements") or "").split())[:200]
    if extra:
        return "the exact user-requested subject"

    category_pool = []
    for cat in _raw_motif_categories(survey):
        for motif in MOTIF_CATEGORY_MAP.get(cat, []):
            if motif not in category_pool:
                category_pool.append(motif)

    # 카테고리 미선택 시, 큐레이션된 풀이 있는 업종만 고정 목록으로 폴백한다.
    pool = category_pool
    if not pool and industry_key in MOTIF_POOL_INDUSTRIES:
        pool = MOTIF_MAP.get(industry_key, [])

    if pool:
        # 브랜드명으로 시작점을 흔들어, 브랜드가 다르면 같은 순번이라도 다른 모티프가
        # 배정되게 한다. variant_index로 시안 간·재생성 회차 간 순환도 함께 준다.
        brand_name = (survey.get("brand_name") or "").strip().lower()
        offset = sum(ord(c) for c in brand_name) if brand_name else 0
        return pool[(offset + variant_index) % len(pool)]

    approach = USER_MOTIF_RENDERING_APPROACHES[
        variant_index % len(USER_MOTIF_RENDERING_APPROACHES)
    ]
    return f"an original brand-specific subject, rendered with {approach}"


# 색상 팔레트를 프롬프트에 넣을 때 쓰는 이름 사전.
# 텍스트 인코더는 "#4F46E5" 같은 헥사 코드를 색으로 해석하지 못한다 — 화면에서 고른
# 색이 프롬프트에서 사실상 무시되고 있었다. 가장 가까운 색 이름으로 바꿔서 넣는다.
# 브랜딩에서 실제로 쓰이는 색 위주로, 명도 단계까지 구분해 뒀다.
_COLOR_NAMES = (
    # --- 무채·중성
    ((255, 255, 255), "white"),
    ((250, 249, 246), "off-white"),
    ((248, 246, 240), "ivory"),
    ((245, 239, 228), "cream ivory"),
    ((240, 234, 220), "soft beige"),
    ((216, 199, 172), "warm sand"),
    ((190, 190, 192), "light grey"),
    ((150, 150, 154), "mid grey"),
    ((120, 120, 125), "cool grey"),
    ((60, 60, 66), "charcoal"),
    ((26, 26, 30), "charcoal black"),
    ((15, 15, 18), "black"),
    # --- 톤다운 그린 (2026 세이지·유칼립투스 계열). 채도가 낮아 회색으로
    #     오분류되기 쉬워 명도별로 촘촘히 둔다.
    ((168, 184, 154), "sage green"),
    ((180, 191, 174), "pale sage"),
    ((142, 160, 130), "muted olive green"),
    ((122, 142, 118), "deep sage"),
    ((160, 190, 110), "fresh olive green"),
    ((110, 170, 140), "soft jade green"),
    ((60, 130, 85), "forest green"),
    ((70, 160, 160), "teal"),
    # --- 어씨 웜 (테라코타·클레이·러스트)
    ((201, 123, 90), "terracotta"),
    ((186, 118, 88), "clay"),
    ((176, 104, 70), "rust"),
    ((139, 115, 85), "clay brown"),
    ((139, 105, 70), "warm brown"),
    ((94, 70, 52), "deep coffee brown"),
    ((176, 141, 87), "bronze"),
    ((198, 168, 110), "gold"),
    # --- 레드·핑크 (버건디 포함)
    ((122, 59, 74), "burgundy"),
    ((150, 45, 60), "deep wine red"),
    ((190, 40, 55), "crimson red"),
    ((219, 88, 86), "warm red"),
    ((224, 122, 95), "coral"),
    ((236, 72, 153), "vivid pink"),
    ((240, 169, 188), "soft rose pink"),
    ((244, 168, 195), "soft pink"),
    ((158, 107, 118), "dusty rose"),
    # --- 옐로
    ((247, 227, 161), "butter yellow"),
    ((250, 220, 110), "soft yellow"),
    ((245, 166, 60), "warm amber"),
    ((205, 160, 60), "mustard"),
    # --- 퍼플·블루
    ((226, 190, 214), "pale lilac"),
    ((181, 123, 224), "vivid lilac"),
    ((150, 100, 190), "violet"),
    ((79, 70, 229), "indigo blue"),
    ((59, 110, 200), "cobalt blue"),
    ((120, 175, 220), "sky blue"),
    ((191, 216, 236), "pale sky blue"),
    ((30, 51, 80), "deep navy"),
)


def _article(word: str) -> str:
    """a / an 선택. 색 이름을 사전에서 뽑아 끼우다 보니 "in a indigo blue"처럼
    관사가 틀어지는 경우가 생긴다."""
    return "an" if word[:1].lower() in "aeiou" else "a"


def _hex_to_color_name(value) -> str:
    """#RRGGBB를 가장 가까운 색 이름으로 바꾼다. 이미 이름이면 그대로 둔다."""
    text = str(value).strip()
    if not text:
        return ""
    raw = text.lstrip("#")
    if len(raw) == 3:
        raw = "".join(c * 2 for c in raw)
    if len(raw) != 6:
        return text  # "gold" 처럼 이미 이름으로 들어온 경우
    try:
        r, g, b = (int(raw[i : i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return text
    # 단순 유클리드 거리로 충분하다 — 후보가 30개뿐이고 정확한 색 재현이 아니라
    # "무슨 색 계열인지"만 모델에 전달하면 되는 용도다.
    return min(_COLOR_NAMES, key=lambda c: sum((a - b_) ** 2 for a, b_ in zip(c[0], (r, g, b))))[1]


def _resolve_colors(survey: dict, tone: str) -> str:
    """색상: AI 추천(톤 기반 자동 매핑) 또는 사용자 직접 지정.

    지정한 색이 2개 이상일 때 그냥 콤마로 나열하면("black, gold") 모델이 한쪽 색만
    반영하고 나머지는 무시하는 경우가 많았다(실측 확인됨 — manual로 black/gold를
    지정해도 결과가 전부 무채색 단색으로만 나옴). "and"로 명시적으로 묶어 두 색이
    함께 쓰여야 하는 조합임을 분명히 한다.
    """
    color_mode = survey.get("color_mode", "ai")
    if color_mode == "manual":
        manual_colors = survey.get("color_manual") or survey.get("colors")
        if isinstance(manual_colors, str):
            manual_colors = [manual_colors]
        if manual_colors:
            named = [_hex_to_color_name(c) for c in manual_colors]
            named = [c for c in dict.fromkeys(named) if c]
            if len(named) == 1:
                return named[0]
            if len(named) == 2:
                return f"{named[0]} and {named[1]}"
            return ", ".join(named[:-1]) + f", and {named[-1]}"
    return TONE_COLOR_MAP.get(tone, "pastel muted tones")


def _fit_to_budget(core: str, optional_parts: list) -> str:
    """core는 절대 자르지 않고, optional_parts를 예산이 허용하는 만큼만 순서대로 덧붙인다.

    프롬프트가 지나치게 길어지면 개별 지시의 반영 강도가 희석되므로, 끝에서부터
    무작정 슬라이싱하면 가장 중요한 품질/형태 지시(core)가 잘려나갈 위험이 있다. 대신 core를
    먼저 확정하고, 톤·미학·가치·연령대·추가요구사항 같은 부가 설명은 예산이 허용하는 동안만
    하나씩 붙인다 — 부족하면 뒤쪽(덜 중요한 것)부터 자연스럽게 생략된다.
    """
    prompt = core
    for part in optional_parts:
        if not part:
            continue
        candidate = f"{prompt} {part}"
        if len(candidate) <= PROMPT_MAX_LEN:
            prompt = candidate
        else:
            break
    return prompt[:PROMPT_MAX_LEN]


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

    for field, aliases in _CURRENT_SURVEY_ALIASES.items():
        value = survey.get(field)
        if value in aliases:
            survey[field] = aliases[value]

    # 가치 칩을 사전 키로 맞춘다. 같은 칩이 두 개 매핑되는 경우가 있어
    # (저자극·더마 → 더마·저자극) 순서를 지키며 중복을 제거한다.
    raw_values = survey.get("brand_values")
    if isinstance(raw_values, str):
        raw_values = [raw_values]
    if raw_values:
        survey["brand_values"] = list(
            dict.fromkeys(_VALUE_ALIASES.get(v, v) for v in raw_values if v)
        )

    color_mode = survey.get("color_mode")
    if isinstance(color_mode, str):
        survey["color_mode"] = color_mode.lower()
    return survey


def build_prompt_from_survey(survey: dict, variant_index: int = 0) -> str:
    """설문을 프롬프트로 변환한다.

    survey는 화면설계서의 CI/BI 화면 필드명(company_name/company_values 등)을 그대로
    넘겨도 되고, 이미 정규화된 공통 키(brand_name/brand_values)를 넘겨도 된다 —
    내부에서 _normalize_survey가 자동으로 맞춰준다.

    variant_index: 동일 설문으로 여러 시안을 생성할 때 0, 1, 2, 3...으로 다르게 넘기면
    시안마다 다른 비주얼 모티프가 배정되어, 랜덤 시드 차이에만 의존하지 않고 실제
    형태 아이디어가 달라진 다양한 시안을 얻을 수 있다.

    프롬프트는 이미지 생성 모델의 텍스트 인코더에 맞춰 완전한 문장으로 조립한다.
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
    concreteness_kw = CONCRETENESS_MAP.get(survey.get("concreteness", ""), "")
    style_sentence = STYLE_MAP.get(style_key, STYLE_MAP["심볼"])

    extra = (survey.get("additional_requirements") or "").strip()
    extra = " ".join(extra.split())[:200]  # 개행 제거 및 과도한 길이 방지

    user_motif_lead = ""
    if extra:
        approach = USER_MOTIF_RENDERING_APPROACHES[
            variant_index % len(USER_MOTIF_RENDERING_APPROACHES)
        ]
        user_motif_lead = (
            f"The primary motif must satisfy this exact user request: {extra}. "
            f"Preserve that requested subject while using {approach}. "
        )

    # core: 반드시 포함돼야 하는 핵심 지시(업종/스타일/색상/모티프+구체성+형태 품질/텍스트
    # 배제 규칙, 그리고 사용자가 직접 적은 추가 요구사항)를 완전한 문장으로 서술한다.
    # 모티프(가장 중요한 정보)를 맨 앞에 배치해 모델이 우선적으로 주목하게 하고, "선이
    # 끊긴다"·"도형이 너무 작다" 문제를 해결했던 지시(fills most of the canvas, unbroken
    # outline)도 core 안에 자연스러운 문장으로 녹여 예산 초과로도 잘리지 않게 한다.
    #
    # additional_requirements(사용자가 직접 적은 자유 서술)는 예전엔 optional_parts
    # 맨 뒤에 있어서 예산(PROMPT_MAX_LEN)이 부족하면 조용히 잘려나갔다(실측
    # 확인됨 — "역동적이고 강렬한 느낌으로" 같은 명시적 지시가 반영 안 되는 문제). 사용자가
    # 직접 쓴 유일한 지시라 core로 승격해 항상 포함되게 한다.
    #
    # 색상(color_kw)은 문장 맨 앞으로 옮겼다 — 원래 "no gradients/shadows" 지시와
    # 같은 문장 뒤쪽에 있었는데, 그러면 특히 2가지 색(예: black+gold)을 지정해도
    # 모델이 한쪽 색만 반영하고 무채색 단색으로만 나오는 경우가 많았다(실측 확인됨).
    # 문장 앞쪽 정보일수록 few-step 모델이 더 강하게 반영하는 경향이 있어, 업종
    # 바로 다음(가장 이른 위치)으로 옮겨 우선순위를 높였다.
    core = (
        user_motif_lead
        + f"A minimalist flat vector logo icon for {industry} "
        f"in {_article(color_kw)} {color_kw} color palette, "
        f"drawn as one bold, large, solid-filled silhouette in {motif_kw}, with a thick, "
        f"clean, unbroken outline that fills the canvas. {style_sentence} "
        + (f"The shape is {concreteness_kw}. " if concreteness_kw else "")
        # tone_kw는 "a friendly, approachable feeling with ..." 처럼 이미 완결된
        # 명사구다. 뒤에 "character"를 붙이면 "...soft shapes character"라는 비문이
        # 된다(실측 확인됨). 문구를 그대로 문장으로 세운다.
        + f"The design conveys {tone_kw or 'a clean, balanced character'}. "
        f"It is flat 2D, with no gradients, shadows, or 3D rendering. "
        f"Centered on a plain white background, with no readable letters or words, "
        f"finished and complete rather than a sketch."
    )

    # 부가 설명은 예산이 남는 만큼만 순서대로 붙인다. value_kw(사용자가 직접 고른 기업
    # 가치)는 다른 곳에 안 나오는 유일한 정보라 최우선으로 두고, aesthetic_kw는 tone에서
    # 파생돼 겹치는 정보가 많아 뒤로 미뤄도 손실이 적다.
    optional_parts = [
        value_kw,
        f"Its target audience has {age_kw}." if age_kw else "",
        f"The overall style references a {aesthetic_kw}." if aesthetic_kw else "",
    ]
    return _fit_to_budget(core, optional_parts)
