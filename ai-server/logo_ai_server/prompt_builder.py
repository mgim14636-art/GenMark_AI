TONE_MAP = {
    "친근함": "playful, rounded shapes, warm and approachable, friendly",
    "전문성": "sharp geometric shapes, professional, structured, sleek",
    "감성": "organic curves, soft, emotional, hand-drawn feel, delicate",
    "미니멀": "minimalist, clean lines, negative space, simple",
}

STYLE_MAP = {
    "심볼": "abstract symbol icon, no letters",
    "워드마크": "typographic wordmark style layout, letterform-inspired shapes",
    "혼합형": "symbol combined with abstract letterform",
    "레터마크": "monogram-style abstract letter shape, elegant typographic mark",
}

INDUSTRY_MAP = {
    "뷰티": "beauty and cosmetics industry",
}

AI_COLOR_RECOMMEND = {
    "친근함": "warm coral and cream tones",
    "전문성": "deep navy, charcoal gray, and metallic silver tones",
    "감성": "soft blush pink and lavender tones",
    "미니멀": "pastel muted green and white tones",
}


def build_prompt_from_survey(survey: dict) -> str:
    industry_kw = INDUSTRY_MAP.get(survey.get("industry", ""), survey.get("industry", ""))
    tone_kw = TONE_MAP.get(survey.get("tone", ""), "")
    style_kw = STYLE_MAP.get(survey.get("style", ""), "abstract symbol icon")
    color_kw = AI_COLOR_RECOMMEND.get(survey.get("tone", ""), "pastel green")

    prompt = (
        f"a {style_kw} logo mark for the {industry_kw}, "
        f"{tone_kw}, {color_kw} color palette, "
        f"no text, no letters, flat vector-style design, "
        f"centered composition, white background"
    )
    return prompt