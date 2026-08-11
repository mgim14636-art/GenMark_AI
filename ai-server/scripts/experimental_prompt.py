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


def build_prompt_v2(survey: dict, variant_index: int = 0) -> str:
    survey = _normalize_survey(survey)

    industry_key = survey.get("industry", "")
    industry = INDUSTRY_MAP.get(industry_key, INDUSTRY_MAP["기타"])
    tone = _normalize_tone(survey.get("tone", ""))
    form = TONE_FORM.get(tone, _DEFAULT_FORM)

    colors = _resolve_colors(survey, tone)
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

    lines += [
        "",
        f"{style_line}",
        (
            f"Build the mark around {motif}, rendered with {form['line']}. "
            f"The result should be {form['density']}, arranged as {form['composition']}, "
            f"using {colors} with {form['contrast']}."
        ),
    ]
    if hints:
        lines.append(" ".join(hints))
    lines += [
        (
            "Render it as clean flat vector artwork on a plain white background, "
            "with generous margin around the mark so it does not touch the edges."
        ),
        (
            "Do not draw any letters, words, numbers, or typography of any kind — "
            "the brand name is added separately afterwards."
        ),
    ]
    return "\n".join(lines)
