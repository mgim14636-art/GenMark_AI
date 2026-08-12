"""[실험용] 프롬프트 조립 v2 — 서비스 코드가 아니다.

app/services/prompt_service.py(담당: 정혜리)를 건드리지 않고, 같은 설문으로
다른 프롬프트를 만들어 결과를 비교하기 위한 스크립트 전용 모듈이다.
채택 여부가 정해지기 전까지 app/ 아래 코드는 이 파일을 import하지 않는다.

현행(v1) 대비 바꾼 것과 그 이유:

1. 선 굵기·밀도를 톤에서 파생시킨다
   v1은 core에 "one bold, large, solid-filled silhouette ... with a thick,
   clean, unbroken outline that fills the canvas"가 고정돼 있다. klein 4B를
   4스텝으로 돌리던 시절 "선이 끊기고 도형이 작다"를 막으려던 대처인데,
   flux.2-pro에는 그 문제가 없어 지금은 품질 상한선으로만 작동한다.
   실측: 같은 모델·같은 키로 손으로 쓴 프롬프트("fine ornamental line art")를
   넣으면 가는 선의 정교한 로고가 나온다.

2. 여백을 확보한다
   v1의 "fills the canvas"를 빼고 명시적으로 margin을 요구한다. 캔버스를
   꽉 채우면 고급스러운 인상이 나오지 않는다.

3. 라벨 블록 구조로 바꾼다
   v1은 쉼표로 이어진 한 문장이라 지시가 서로 묻힌다. 항목을 나눠 적고
   마지막에 요약 문장을 둔다.

4. "letterform-like" 표현을 걷어낸다
   v1의 혼합형 문장(The mark combines a graphic symbol with an abstract
   letterform-like silhouette)을 모델이 실제 글자로 해석해 심볼 안에 'G'가
   박히는 사례가 나왔다(실측 확인됨). 배치로 서술한다.

유지한 것:
   "글자를 넣지 말 것" 규칙은 그대로 둔다. 브랜드명은 logo_composer가 폰트
   레이어로 합성한다 — 기획서 (기술적 배경)의 한글 렌더링 한계 대응이고,
   유사도 분석도 텍스트가 결합된 최종 로고를 기준으로 한다(ai-api.md 실험 2).
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.prompt_service import (  # noqa: E402
    INDUSTRY_MAP,
    TONE_AESTHETIC_MAP,
    _normalize_survey,
    _normalize_tone,
    _resolve_colors,
    _resolve_motif,
    _resolve_values,
)

# 톤별 조형 지시. v1은 이 네 축이 전부 고정값이었다.
#   line        선의 성격·굵기
#   density     장식 밀도 (v1은 항상 "minimalist flat")
#   composition 구도와 여백 (v1은 항상 "fills the canvas")
#   contrast    명암 대비
TONE_FORM = {
    "친근하고 다정한": {
        "line": "soft rounded line work of medium weight",
        "density": "warm and approachable, with a few gentle decorative touches",
        "composition": "a balanced centered composition with comfortable breathing room",
        "contrast": "gentle tonal contrast",
    },
    "전문적이고 신뢰감 있는": {
        "line": "precise even line work with crisp geometric edges",
        "density": "restrained and structured, refined rather than decorative",
        "composition": "a symmetrical well-proportioned composition with generous margins",
        "contrast": "clear confident contrast",
    },
    "감성적이고 따뜻한": {
        "line": "fine delicate line art with gracefully tapering strokes",
        "density": "visually rich, with subtle ornamental accents and small organic details",
        "composition": "an elegant emblem composition with airy negative space",
        "contrast": "soft layered tonal contrast",
    },
    "유니크하고 트렌디한": {
        "line": "bold confident strokes offset by fine accent lines",
        "density": "striking and expressive, with sharp geometric accents",
        "composition": "an unconventional off-centre composition that still reads clearly",
        "contrast": "high striking contrast",
    },
    "미니얼하고 직관적인": {
        "line": "clean uniform line work of light to medium weight",
        "density": "pared back to essentials, with no ornamentation",
        "composition": "a centered composition with abundant negative space",
        "contrast": "restrained two-tone contrast",
    },
}

_DEFAULT_FORM = TONE_FORM["전문적이고 신뢰감 있는"]

# 가치 키워드가 조형에 주는 보정. "프리미엄"을 골랐는데 밋밋하게 나오는 걸 막는다.
VALUE_FORM_HINT = {
    "프리미엄": "Treat it as a premium brand mark: elevated, polished, and quietly luxurious.",
    "감성적": "Let the mark feel hand-crafted and emotive rather than mechanical.",
    "자연주의": "Let organic, botanical rhythms guide the curves.",
    "트렌디": "Give it a contemporary, fashion-forward edge.",
    "한방·전통": "Echo traditional craft motifs in the detailing.",
}

# 톤별 팔레트 — 색을 나열하지 않고 "역할"로 정의한다.
#
# v1은 고른 색을 "A and B"로 동등하게 이어 붙였다. 그러면 모델이 두 색을 같은
# 비중으로 써서 마크가 산만해진다. 브랜딩에서 색은 위계다 — 주조색이 화면을
# 지배하고 보조색은 액센트로만 들어가며, 중성색은 그리는 색이 아니라 배경이다.
#
# 잉크는 최대 2색으로 제한한다. 3색 이상은 로고가 산만해지고 인쇄 시 별색 비용도
# 올라간다. neutral은 배경이므로 이 2색에 포함하지 않는다.
# 값은 (색 이름, HEX). 이름은 프롬프트 문장용, HEX는 Recraft controls.colors로
# 넘겨 색을 정확히 지정하는 용도다.
TONE_PALETTE = {
    "친근하고 다정한": {
        "primary": ("soft rose pink", "#F0A9BC"),
        "secondary": ("butter yellow", "#F7E3A1"),
        "neutral": ("cream", "#FBF6EF"),
    },
    "전문적이고 신뢰감 있는": {
        "primary": ("deep navy", "#1E3350"),
        "secondary": ("warm sand", "#D8C7AC"),
        "neutral": ("off-white", "#F7F5F0"),
    },
    "감성적이고 따뜻한": {
        "primary": ("terracotta", "#C97B5A"),
        "secondary": ("sage green", "#A8B89A"),
        "neutral": ("cream ivory", "#F5EFE4"),
    },
    "유니크하고 트렌디한": {
        "primary": ("charcoal black", "#1A1A1E"),
        "secondary": ("vivid lilac", "#B57BE0"),
        "neutral": ("off-white", "#FAF8FB"),
    },
    "미니얼하고 직관적인": {
        "primary": ("charcoal", "#2E2E33"),
        "secondary": ("sage green", "#B4BFAE"),
        "neutral": ("off-white", "#FAF9F6"),
    },
}

# 배색 전략: 로고 한 장에는 반드시 한 색만. 시안 4장은 서로 다른 색을 쓴다.
#
# 이전에는 단색/주조+액센트/반전/톤온톤 네 전략을 순환시켰다. 면(fill) 기반일
# 때는 잘 작동했지만 선(monoline) 기반으로 바꾸자 무너졌다 — 특히 "톤온톤"은
# 두 톤의 농담을 표현하려고 가는 선을 촘촘히 겹쳐 path 1,348개짜리 모아레가
# 나왔다(minimal/logo_4.svg, 558KB, 실측 확인됨).
#
# 단색은 브랜딩 관점에서도 정석이다. 로고는 1색 인쇄·자수·각인·팩스까지
# 견뎌야 하고, CI 매뉴얼은 보통 주조색 1색 원본에서 출발한다.
# 다양성은 색을 섞어서가 아니라 시안마다 다른 색을 배정해 확보한다.

# 사용자 지정색과 톤 팔레트로 4장을 못 채울 때 뒤에 붙이는 색.
# 무채색 계열이라 어떤 브랜드에도 얹히고, 실제로 로고 단색 버전에서 가장 많이 쓴다.
FALLBACK_INKS = (
    ("charcoal", "#2E2E33"),
    ("deep navy", "#1E3350"),
)

SINGLE_COLOR_TMPL = "{c} as the only colour of the entire mark, on a {n} background"


def resolve_motif_from_values(survey: dict, variant_index: int) -> str:
    """사용자가 고른 '기업 가치'에서 그릴 대상을 정한다.

    v3에서 모티프를 통째로 뺐더니 모델이 그릴 대상을 못 찾고 장식적 추상으로
    흘렀다(실타래·스피로그래프, 실측 확인됨). 레퍼런스로 받은 코스메틱 로고들은
    전부 알아볼 수 있는 사물이다 — 나비·잎사귀·튤립·물방울. 형태가 단순한 이유는
    획을 줄여서가 아니라 그릴 대상이 명확해서다.

    다만 v1/v2 방식(브랜드명 유니코드 합으로 MOTIF_MAP에서 무작위 선택)은
    설문과 무관한 값이 나오므로 쓰지 않는다. 대신 prompt_service에 정의만 되어
    있고 아무도 읽지 않던 VALUE_MOTIF_BIAS를 쓴다 — 사용자가 실제로 고른
    가치 키워드에서 후보가 나오므로 근거가 설명된다.
    (docs/2026-08-11_로고생성_문제점-점검.md 13번 항목)

    시안마다 다른 후보를 배정해 형태 다양성도 함께 확보한다.
    """
    from app.services.prompt_service import MOTIF_MAP, VALUE_MOTIF_BIAS, _raw_value_keys

    pool = []
    for key in _raw_value_keys(survey):
        for m in VALUE_MOTIF_BIAS.get(key, []):
            if m not in pool:
                pool.append(m)
    if not pool:
        # 가치를 안 골랐으면 업종 기본 풀로 떨어진다
        pool = list(MOTIF_MAP.get(survey.get("industry", ""), [])) or [
            "a single botanical leaf silhouette"
        ]
    return pool[variant_index % len(pool)]


def single_color_pool(survey: dict, tone: str):
    """시안에 하나씩 배정할 단색 후보. 앞에서부터 variant_index 순으로 쓴다.

    우선순위: 사용자가 고른 색 → 톤 기본 팔레트 → 무채색 폴백.
    같은 HEX가 중복되면 제거한다(사용자가 1색만 골랐을 때 4장이 다 같아지는 것 방지).
    """
    pal = TONE_PALETTE.get(tone, TONE_PALETTE["전문적이고 신뢰감 있는"])
    manual = survey.get("color_manual") or survey.get("colors")
    if isinstance(manual, str):
        manual = [manual]

    pool = []
    if survey.get("color_mode") == "manual" and manual:
        from app.services.prompt_service import _hex_to_color_name
        pool += [(_hex_to_color_name(v), str(v)) for v in manual]
    pool += [pal["primary"], pal["secondary"], *FALLBACK_INKS]

    seen, out = set(), []
    for name, hx in pool:
        key = str(hx).lower()
        if name and key not in seen:
            seen.add(key)
            out.append((name, hx))
    return out


def resolve_roles(survey: dict, tone: str):
    """(주조, 보조, 배경)을 각각 (이름, HEX)로 돌려준다.

    사용자가 직접 색을 골랐으면 고른 순서를 그대로 주조/보조로 쓴다.
    """
    pal = TONE_PALETTE.get(tone, TONE_PALETTE["전문적이고 신뢰감 있는"])
    p, s, n = pal["primary"], pal["secondary"], pal["neutral"]

    manual = survey.get("color_manual") or survey.get("colors")
    if isinstance(manual, str):
        manual = [manual]

    if survey.get("color_mode") == "manual" and manual:
        from app.services.prompt_service import _hex_to_color_name
        picked = [(_hex_to_color_name(v), str(v)) for v in manual]
        picked = [x for x in picked if x[0]]
        if picked:
            p = picked[0]
            s = picked[1] if len(picked) > 1 else picked[0]
            # 3색 이상 골랐어도 잉크는 앞의 두 개만. 세 번째는 배경으로 돌린다
            n = picked[2] if len(picked) > 2 else n
    return p, s, n


def scheme_for(survey: dict, tone: str, variant_index: int):
    """이 시안이 쓸 단색 (이름, HEX)."""
    pool = single_color_pool(survey, tone)
    return pool[variant_index % len(pool)]


def resolve_palette(survey: dict, tone: str, variant_index: int) -> str:
    """"이 색 하나만 써라"를 못 박는 문장."""
    _, _, n = resolve_roles(survey, tone)
    ink = scheme_for(survey, tone, variant_index)
    return SINGLE_COLOR_TMPL.format(c=ink[0], n=n[0])


def _hex_to_rgb(hx: str):
    hx = str(hx).lstrip("#")
    if len(hx) == 3:
        hx = "".join(c * 2 for c in hx)
    return [int(hx[i:i + 2], 16) for i in (0, 2, 4)] if len(hx) == 6 else None


def recraft_controls(survey: dict, tone: str, variant_index: int, no_text: bool = True) -> dict:
    """Recraft의 controls 파라미터를 만든다.

    프롬프트 문장으로 색을 설득하는 대신 RGB를 직접 지정한다. 배색 전략에 맞춰
    실제로 쓸 색만 넘겨야 의미가 있다 — 단색 시안에 두 색을 다 넘기면 결국
    두 색이 다 나온다.

    no_text=True는 모델이 글자를 그리지 않게 하는 스위치다. 다만 Recraft V3 전용이라
    V4 계열에 넣으면 400이 떨어진다("Recraft V4 doesn't support the 'no_text' control",
    실측 확인됨). 호출부가 모델 지원 여부를 보고 넘겨야 한다.
    """
    _, _, n = resolve_roles(survey, tone)
    ink = scheme_for(survey, tone, variant_index)

    # 한 시안 = 한 색. 두 색을 넘기면 모델이 두 색을 다 쓴다(실측 확인됨).
    colors = [{"rgb": rgb} for rgb in (_hex_to_rgb(ink[1]),) if rgb]
    controls = {"colors": colors}
    if no_text:
        controls["no_text"] = True
    bg = _hex_to_rgb(n[1])
    if bg:
        controls["background_color"] = {"rgb": bg}
    return controls


# v1 STYLE_MAP의 "letterform-like" 표현을 배치 서술로 바꾼 것
STYLE_FORM = {
    "심볼": "A standalone graphic symbol. It contains no letters or characters of any kind.",
    "워드마크": (
        "A single abstract mark whose curves echo the rhythm of handwriting, "
        "but which contains no readable characters."
    ),
    "혼합형": (
        "A graphic symbol intended to sit directly above a brand name that will be "
        "typeset separately afterwards. The symbol itself contains no letters."
    ),
    "레터마크": (
        "A compact monogram-like emblem built from abstract strokes, "
        "containing no readable characters."
    ),
}


# 마무리 지시. 앞의 Requirements가 개별 항목을 지정한다면, 이 문단은 그것들을
# 하나의 브랜드 마크로 묶어 달라고 요청한다. 팀에서 제안한 문구를 그대로 쓴다.
CLOSING = (
    "Create a logo that reflects the brand identity and selected attributes. "
    "Use the requested colors, shape, and style consistently. "
    "Let the brand values and tone guide the overall visual direction. "
    "Make the design distinctive, balanced, scalable, and visually coherent. "
    "Ensure it is suitable for branding across packaging, digital platforms, "
    "and marketing materials. Keep it clear and not overly cluttered."
)

# 마크 무결성 — 벡터 실측 2회에서 나온 결함을 겨냥한다.
#
# 1) "패턴화" (1차): 하나의 마크가 아니라 타일 무늬로 나왔다
#    (minimal_a/logo_1.svg — 도형 10개가 격자로 흩어짐).
#    → "one single unified shape"로 해결됨. 유지한다.
#
# 2) "시각적 과밀" (1·2차 공통): path 5~38개가 겹치고 속이 꽉 찬 실루엣이라
#    로고가 아니라 일러스트로 보인다. 명함 크기로 줄이면 뭉개진다.
#    → 원인은 요소 "개수"보다 면(fill) 조형이다. 같은 나비도 검게 칠하면
#      무겁고 선으로 그리면 가볍다. 선(stroke) 기반으로 전환한다.
#
#    주의: 2차에서 내가 넣은 "Use flat solid fills only ... no outlines"가
#    정확히 이 방향을 금지하고 있었다. 그래서 반전시킨다.
#
# 3) "음영 색 증식": 지정하지 않은 중간톤이 시안마다 1~7종 섞인다.
#    문장으로는 절반만 막혔다(11종 → 7종). 남은 것은 전부 지정색의 명암
#    변주라 SVG fill 값을 후처리로 스냅하는 편이 확실하다. 문장은 보조로만 둔다.
MARK_INTEGRITY = (
    "The mark must be one single unified shape — not a pattern, not a tile, "
    "and not a grid of separate scattered elements. "
    "Draw it as fine monoline line art: thin strokes of uniform weight, "
    "open unfilled shapes, with visible empty space inside the form. "
    "Do not fill the silhouette with solid colour. "
    # 뺀 것 1: "at most three simple elements" — 무시됨 (path 12~1,348개, 실측).
    # 뺀 것 2: "a single continuous line, as if drawn without lifting the pen"
    #   → 모델이 "끊기지 않고 계속 이어지는 선"으로 읽어 스피로그래프를 그렸다
    #     (4차 실측: path 24/55/261/42, 전부 실타래). 직접적인 실패 원인.
    # 뺀 것 3: "Do not repeat, mirror, or tile" — 3회 연속 무시됨.
    #   안 듣는 부정문은 프롬프트만 길게 하고 다른 지시를 희석시킨다.
    #
    # 대신 획을 "세지" 말고 "아끼게" 한다. 개수 상한보다 이쪽이 잘 먹는다.
    "Draw it with as few strokes as possible — the fewer the better. "
    "Keep it simple enough to stay legible when scaled down to 16 pixels. "
    "Use exactly one colour for every stroke — no second colour, "
    "no lighter or darker variants of it, no shading, no gradients."
)

# 글자 처리 — 서로 배타적인 두 갈래라 하나만 들어간다.
NO_TYPOGRAPHY = (
    "Do not draw any letters, words, numbers, or typography of any kind — "
    "the brand name is added separately afterwards."
)
WITH_TYPOGRAPHY = (
    'If typography is included, render the brand name exactly as "{brand}".'
)


def build_prompt_minimal(survey: dict, variant_index: int = 0, typography: bool = False) -> str:
    """[v3] 설문에서 사용자가 실제로 입력한 값만 넣는다.

    v1/v2는 설문에 없는 것까지 우리가 정해서 밀어 넣는다 — 모티프(잎사귀·물방울·
    보석 등), 선 굵기, 장식 밀도, 구도, 명암 대비, 디자인 사조. 그 결과 "왜 이런
    도형이 나왔는지" 사용자도 우리도 설명할 수 없는 시안이 나온다. 특히 모티프는
    브랜드명 유니코드 합으로 고르므로 브랜드와 아무 관계가 없다.

    이 버전은 그걸 전부 빼고 모델에게 조형을 맡긴다. 넣는 것은 다음뿐이다.
        업종 / 브랜드명 / 브랜드 가치 / 톤앤매너 / 색상 / 타겟 연령 / 추가 요청

    비교 목적: 우리가 조형까지 지시하는 것이 실제로 품질을 올리는가,
    아니면 모델의 판단을 막고 있을 뿐인가.
    """
    survey = _normalize_survey(survey)

    from app.services.prompt_service import TARGET_AGE_MODIFIER, TONE_MAP

    industry_key = survey.get("industry", "")
    industry = INDUSTRY_MAP.get(industry_key, INDUSTRY_MAP["기타"])
    tone = _normalize_tone(survey.get("tone", ""))

    brand = (survey.get("brand_name") or "").strip()
    values_line = _resolve_values(survey)
    tone_kw = TONE_MAP.get(tone, "")
    age_kw = TARGET_AGE_MODIFIER.get(survey.get("target_age", ""), "")
    colors = resolve_palette(survey, tone, variant_index)
    extra = " ".join((survey.get("additional_requirements") or "").split())[:200]

    motif = resolve_motif_from_values(survey, variant_index)

    lines = [f"Design a logo mark for {industry}."]
    # 그릴 대상을 맨 앞에 둔다. 조형 지시(뒤쪽 MARK_INTEGRITY)보다 먼저 와야
    # 모델이 "무엇을"부터 정하고 "어떻게"를 얹는다.
    lines.append(f"The mark depicts {motif}.")
    if brand:
        # 브랜드명은 "그려라"가 아니라 "무엇을 위한 로고인가"의 정보로만 준다.
        lines.append(f'The brand is called "{brand}".')
    if values_line:
        lines.append(values_line)
    if tone_kw:
        lines.append(f"It should convey {tone_kw}.")
    if age_kw:
        lines.append(f"Its target audience responds to {age_kw}.")
    lines.append(f"Use {colors}.")
    if extra:
        lines.append(f"Must include, exactly as requested: {extra}.")

    lines += [
        "",
        CLOSING,
        MARK_INTEGRITY,
        (
            "Render it as clean flat vector artwork on a plain white background, "
            "with generous margin around the mark so it does not touch the edges."
        ),
        WITH_TYPOGRAPHY.format(brand=brand) if (typography and brand) else NO_TYPOGRAPHY,
    ]
    return "\n".join(lines)


def build_prompt_v2(survey: dict, variant_index: int = 0, typography: bool = False) -> str:
    """typography=True면 모델이 브랜드명을 직접 그리게 한다.

    기본은 False — 한글 렌더링 한계 때문에 브랜드명은 logo_composer가 폰트로
    합성하는 것이 현재 설계다(기획서 기술적 배경). True는 "모델이 한글을 제대로
    쓸 수 있는가"를 실측하기 위한 실험용 경로다.
    """
    survey = _normalize_survey(survey)

    industry_key = survey.get("industry", "")
    industry = INDUSTRY_MAP.get(industry_key, INDUSTRY_MAP["기타"])
    tone = _normalize_tone(survey.get("tone", ""))
    form = TONE_FORM.get(tone, _DEFAULT_FORM)

    colors = resolve_palette(survey, tone, variant_index)
    motif = _resolve_motif(industry_key, survey, variant_index)
    style_line = STYLE_FORM.get(survey.get("style", ""), STYLE_FORM["심볼"])
    aesthetic = TONE_AESTHETIC_MAP.get(tone, "")
    values_line = _resolve_values(survey)

    extra = " ".join((survey.get("additional_requirements") or "").split())[:200]

    hints = []
    for key in survey.get("brand_values") or []:
        hint = VALUE_FORM_HINT.get(key)
        if hint and hint not in hints:
            hints.append(hint)

    lines = [
        f"Design a logo mark for {industry}.",
        "",
        "Requirements:",
        f"- Motif: {motif}",
        f"- Colors: {colors}",
        f"- Line work: {form['line']}",
        f"- Detail level: {form['density']}",
        f"- Composition: {form['composition']}",
        f"- Contrast: {form['contrast']}",
    ]
    if aesthetic:
        lines.append(f"- Reference aesthetic: {aesthetic}")
    if values_line:
        lines.append(f"- {values_line}")
    if extra:
        lines.append(f"- Must include, exactly as requested: {extra}")

    brand = (survey.get("brand_name") or "").strip()

    lines += [
        "",
        f"{style_line}" if not typography else
        "The mark may combine a graphic symbol with the brand name set beneath it.",
        (
            f"Build the mark around {motif}, rendered with {form['line']}. "
            f"The result should be {form['density']}, arranged as {form['composition']}, "
            f"using {colors} with {form['contrast']}."
        ),
    ]
    if hints:
        lines.append(" ".join(hints))
    lines += [
        CLOSING,
        (
            "Render it as clean flat vector artwork on a plain white background, "
            "with generous margin around the mark so it does not touch the edges."
        ),
        WITH_TYPOGRAPHY.format(brand=brand) if (typography and brand) else NO_TYPOGRAPHY,
    ]
    return "\n".join(lines)
