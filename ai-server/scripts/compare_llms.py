"""[실험용] 프롬프트 생성용 LLM 후보 비교.

설문(한글)을 받아 Recraft에 넣을 영어 프롬프트 재료를 JSON으로 뽑아내는 작업에
어떤 모델이 적합한지 고른다. 이미지 모델을 고를 때 compare_models.py로 했던 것과
같은 방식이며, app/ 아래 서비스 코드는 건드리지 않는다.

    cd ai-server
    python scripts/compare_llms.py --list              # 모델 목록·가격만 (무료)
    python scripts/compare_llms.py --list --free       # 무료 모델만
    python scripts/compare_llms.py --dry               # 보낼 프롬프트만 출력 (무료)
    python scripts/compare_llms.py                     # 기본 후보로 실제 비교
    python scripts/compare_llms.py --models google/gemini-2.0-flash-001,openai/gpt-4o-mini

무엇을 보는가:
    1. 한국어 자유서술(기업 모토, 원하는 로고 모양)을 제대로 이해하는가
    2. JSON 형식을 어기지 않는가 — 어기면 파싱 실패로 서비스가 멈춘다
    3. 모티프를 "구체적 사물"로 뽑는가
       실측(2026-08-12): 물방울·보석 같은 사물은 로고가 나오고,
       "soft wave curve"·"radiant glow" 같은 추상어는 전부 실타래가 됐다.
       이 과제에서 모델을 가르는 가장 중요한 기준이다.
    4. 시안 4개가 서로 다른가

산출물:
    data/outputs/llm_compare/<모델별칭>.json   각 모델의 원문 응답
    data/outputs/llm_compare/summary.md        판정 요약표
"""
import os

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

OUT_DIR = ROOT / "data" / "outputs" / "llm_compare"
CHAT_API = "https://openrouter.ai/api/v1/chat/completions"
MODELS_API = "https://openrouter.ai/api/v1/models"

# 처음 돌려볼 후보. --list로 실제 목록을 본 뒤 --models로 바꿔가며 시험한다.
# 이 과제는 입력·출력이 짧고(각 1KB 미만) 판단이 단순해서 대형 모델이 필요 없다.
# 한국어 이해도와 JSON 준수가 갈림길이다.
DEFAULT_MODELS = [
    "google/gemini-2.0-flash-001",
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-haiku",
]

# ---------------------------------------------------------------- 시스템 프롬프트
#
# 오늘(2026-08-12) 이미지 모델 실험 6회에서 얻은 결론을 규칙으로 박는다.
# LLM 판단에 맡기면 그대로 재발하는 것들이라 "하지 말라"가 아니라
# "이렇게만 하라"로 못 박는다.
SYSTEM_PROMPT = """\
You turn a Korean beauty-brand survey into design directions for a logo.

Return ONLY a JSON object. No markdown fence, no commentary.

{"concept": "<one English sentence describing the brand's visual identity>",
 "variants": [
   {"motif": "<a concrete object, English>", "form": "<how it is arranged, English>"},
   ... exactly 4 items ...
 ]}

RULES for "motif" — these are not style preferences, they are hard requirements:

1. A motif MUST be a concrete, nameable object that a person could point at.
   GOOD: "a dewdrop resting on a leaf", "a camellia blossom", "a crescent moon",
         "a cut gemstone", "a swan's neck", "a glass dropper bottle"
   BAD:  "a soft wave curve", "a radiant glow", "an infinity loop",
         "flowing energy", "harmony", "an abstract form"
   Abstract qualities make the image model draw decorative spirals instead of a
   logo. This is the single most important rule.

2. One motif = one drawable thing. Two objects may combine only if the user
   asked for that combination.

3. Variety across the four options depends on whether the user named a shape:
   - If the user described a shape they want ("원하는 로고 모양"), KEEP that
     subject in all four. Vary the ARRANGEMENT instead — viewpoint, which part
     leads, how the parts overlap, open vs enclosed.
   - If the user named no shape, use four visibly different objects.
   Do not substitute a different subject for one the user explicitly asked for.

4. Never use the brand name, letters, numbers, or typography in a motif.

5. The brand name is given only as background — it may inspire the subject
   (a brand called "luna" may suggest a moon), but the drawn mark is the
   symbol ALONE.

RULES for "form":
   Describe the internal arrangement of the symbol only, in a short phrase.
   GOOD: "one closed contour, vertically symmetrical", "seen from the side,
         slightly tilted", "two shapes overlapping at the centre"
   BAD:  "centred above the wordmark", "to the left of the brand name"
         — the symbol is generated on its own; the brand name is typeset
         separately afterwards, so its position is not yours to decide.
         Mentioning it makes the image model draw letters.
   BAD:  anything about colour, line weight, shading, or "continuous line"
         (the image model reads "continuous line" as a spirograph).

Never mention text, letters, typography, a wordmark, or the brand name
anywhere in "motif", "form", or "concept".
Do not mention colours anywhere — colours are applied separately.
Write "concept" and all values in English, even though the input is Korean.
"""

# 실제 화면(App.tsx)에서 사용자가 고를 수 있는 값으로 구성한 예시 설문.
# 자유서술 두 칸이 이 실험의 핵심이다 — 사전으로는 절대 처리할 수 없는 부분이라
# LLM을 넣는 이유 자체가 여기에 있다.
SURVEY = {
    "업종": "뷰티 · 화장품",
    "기업명": "젠마크",
    "브랜드 가치": ["클린뷰티", "프리미엄", "감성적"],
    "주요 타겟": "20-30대",
    "톤앤매너": "감성적이고 따뜻한",
    "로고 타입": "콤비네이션 (심볼 + 브랜드명)",
    "기업 모토": "자연에서 온 순수함을 담아 지친 피부에 하루의 휴식을 선물합니다.",
    "원하는 로고 모양": "물방울과 잎사귀가 겹쳐진 느낌이면 좋겠어요. 너무 복잡하지 않게.",
}


# 백엔드가 실제로 보내는 값 그대로. 영문 id·HEX·한글 자유서술이 섞여 있다.
# (ci_project 한 건을 그대로 옮긴 것)
REAL_SURVEY_RAW = {
    "industry": "cosmetics",
    "company_name": "luna",
    "corevalues": "혁신적인",
    "tone": "minimal",
    "color1": "#396fc8",
    "color2": "#dde4ff",
    "logo_style": "combination",
    "additional_require": "로고형태 : 달모양",
}

# id -> 사람이 읽는 라벨. 화면(App.tsx)이 쓰는 문구를 그대로 따른다.
# LLM에게 'minimal'만 주면 "군더더기 없이 명확한 인상"이라는 뉘앙스가 사라진다.
# 이 변환은 결정적이고 비용이 0이라 LLM에 맡길 이유가 없다.
_TONE_LABEL = {
    "friendly": "친근하고 다정한 (편안하고 부드러운 인상)",
    "professional": "전문적이고 신뢰감 있는 (정돈되고 믿음직한 인상)",
    "warm": "감성적이고 따뜻한 (섬세하고 따뜻한 인상)",
    "trendy": "유니크하고 트렌디한 (개성 있고 감각적인 인상)",
    "minimal": "미니멀하고 직관적인 (군더더기 없이 명확한 인상)",
}
# 로고 타입은 "최종 결과물이 어떤 형태인가"이지 "지금 무엇을 그리는가"가 아니다.
# 콤비네이션을 "심볼 + 브랜드명"이라고 알려줬더니 LLM이 워드마크와의 배치를
# 설명했고("centred above the wordmark"), 그게 프롬프트에 들어가면 이미지 모델이
# 글자를 그린다(실측 확인됨). 어느 타입이든 지금 그리는 건 심볼뿐이라고 못 박는다.
_STYLE_LABEL = {
    "symbol": "심볼마크 — 심볼 단독으로 사용됨",
    "wordmark": "워드마크 — 브랜드명 글씨가 주가 되고, 심볼은 작게 곁들여짐",
    "combination": "콤비네이션 — 최종적으로 브랜드명과 함께 쓰이지만, 지금 만드는 건 심볼뿐",
    "lettermark": "레터마크 — 이니셜 느낌의 간결한 엠블럼",
}
_INDUSTRY_LABEL = {
    "cosmetics": "뷰티 · 화장품",
    "COSMETICS": "뷰티 · 화장품",
}


def normalize_for_llm(raw: dict) -> dict:
    """LLM에 넘기기 전에 코드가 먼저 정리한다.

    - id는 화면 라벨로 편다 (minimal -> 미니멀하고 직관적인 ...)
    - 색상 HEX는 아예 빼버린다. 색은 controls.colors로 RGB를 직접 넘겨
      오차 0을 확보한 부분이라, LLM이 색 이름을 지어내면 이중 지시가 된다.
    - 자유서술은 손대지 않는다. 그걸 읽는 게 LLM을 쓰는 이유다.
    """
    out = {}
    if raw.get("industry"):
        out["업종"] = _INDUSTRY_LABEL.get(raw["industry"], raw["industry"])
    if raw.get("company_name"):
        out["기업명"] = raw["company_name"]
    if raw.get("corevalues"):
        out["기업 가치·모토"] = raw["corevalues"]
    if raw.get("tone"):
        out["톤앤매너"] = _TONE_LABEL.get(raw["tone"], raw["tone"])
    if raw.get("logo_style"):
        out["로고 타입"] = _STYLE_LABEL.get(raw["logo_style"], raw["logo_style"])
    if raw.get("additional_require"):
        out["원하는 로고 모양"] = raw["additional_require"]
    # color1/color2는 의도적으로 제외한다
    return out


def build_user_message(survey: dict) -> str:
    lines = []
    for k, v in survey.items():
        lines.append(f"{k}: {', '.join(v) if isinstance(v, list) else v}")
    lines.append("")
    lines.append("위 설문으로 로고 시안 4개의 방향을 정해줘.")
    return "\n".join(lines)


# ---------------------------------------------------------------- 모델 목록
def list_models(free_only: bool = False):
    res = requests.get(MODELS_API, timeout=20)
    res.raise_for_status()
    rows = []
    for m in res.json().get("data", []):
        pricing = m.get("pricing") or {}
        try:
            pin = float(pricing.get("prompt", 0) or 0)
            pout = float(pricing.get("completion", 0) or 0)
        except (TypeError, ValueError):
            continue
        # openrouter/auto 같은 라우터 모델은 가격 필드에 음수 플레이스홀더를 넣는다
        # (실제 단가는 라우팅된 모델을 따른다). 표에 섞이면 정렬이 망가지므로 뺀다.
        if pin < 0 or pout < 0:
            continue
        if free_only and (pin > 0 or pout > 0):
            continue
        # 이 과제 기준 1회 호출 비용 (입력 700토큰 / 출력 400토큰 가정)
        est = pin * 700 + pout * 400
        rows.append((est, m.get("id", ""), pin, pout, m.get("context_length") or 0))
    rows.sort()
    return rows


def print_models(free_only: bool = False):
    rows = list_models(free_only)
    print(f"\n{'모델':<52}{'1회 예상':>10}{'컨텍스트':>10}")
    print("-" * 74)
    for est, mid, _pin, _pout, ctx in rows[:60]:
        cost = "무료" if est == 0 else f"${est:.5f}"
        print(f"{mid:<52}{cost:>10}{ctx:>10,}")
    print(f"\n총 {len(rows)}개. 이 과제는 입력 ~700 / 출력 ~400 토큰 기준입니다.")


# ---------------------------------------------------------------- 호출
def call_llm(api_key: str, model: str, system: str, user: str, json_mode: bool = True):
    """무료 티어는 429가 흔하다. 잠깐 기다렸다 두 번까지 다시 시도한다.

    json_mode=True면 response_format으로 JSON을 강제한다. 지원하지 않는 모델은
    400을 돌려주므로, 그때는 끄고 한 번 더 시도한다 — 지원 여부 자체가 판정 항목이다.
    """
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        # 프롬프트 재료는 매번 달라질 이유가 없다. 재현성을 위해 낮춘다.
        "temperature": 0.4,
        # 추론형 모델은 생각을 길게 쓰다가 잘려서 JSON이 미완성으로 끝난다.
        # 넉넉히 준다.
        "max_tokens": 2000,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    started = time.monotonic()
    last = None
    for attempt in range(3):
        res = requests.post(
            CHAT_API,
            headers={"Authorization": f"Bearer {api_key}",
                     "Content-Type": "application/json"},
            json=payload,
            timeout=120,
        )
        if res.ok:
            body = res.json()
            choice = (body.get("choices") or [{}])[0]
            msg = choice.get("message") or {}
            text = msg.get("content") or ""
            # 추론형 모델은 본문을 비우고 reasoning에만 답을 담기도 한다
            if not text:
                text = msg.get("reasoning") or ""
            return text, time.monotonic() - started, body.get("usage") or {}, choice.get("finish_reason")

        if res.status_code == 429:
            last = f"HTTP 429 (무료 티어 레이트 리밋)"
            time.sleep(4 * (attempt + 1))
            continue
        if res.status_code == 400 and json_mode:
            # JSON 모드 미지원 — 끄고 재시도
            payload.pop("response_format", None)
            json_mode = False
            continue
        raise RuntimeError(f"HTTP {res.status_code}: {res.text[:200]}")

    raise RuntimeError(last or "알 수 없는 실패")


def extract_json(text: str):
    """```json 펜스나 앞뒤 설명이 붙어 와도 살려낸다.

    JSON만 달라고 해도 지키지 않는 모델이 있다. 그 자체가 판정 항목이므로
    (strict 여부) 살려내되 어겼다는 사실은 따로 기록한다.
    """
    stripped = text.strip()
    strict = stripped.startswith("{") and stripped.endswith("}")
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None, strict
    try:
        return json.loads(m.group(0)), strict
    except json.JSONDecodeError:
        return None, strict


# 추상어 탐지 — 실측에서 실타래를 유발한 표현들.
#
# 부분 문자열로 찾으면 안 된다. "a curved leaf cradling a water droplet"은
# 'curve'를 포함하지만 그리는 대상은 잎사귀와 물방울이라 아무 문제가 없다
# (첫 판정에서 이걸 오탐으로 잡았다).
#
# 문제가 되는 건 "무엇을 그리는가"에 해당하는 중심 명사가 추상어일 때다.
#   "a soft wave curve"      -> 중심 명사 curve  = 그릴 사물이 없다  ❌
#   "a leaf cradling a drop" -> 중심 명사 drop   = 물방울을 그린다    ✅
# 그래서 마지막 명사만 본다.
ABSTRACT_HEADS = {
    "curve", "curves", "glow", "flow", "swoosh", "essence", "energy",
    "harmony", "infinity", "loop", "loops", "burst", "ribbon", "wave",
    "waves", "spiral", "form", "forms", "shape", "shapes", "aura",
    "radiance", "motion", "symbol", "mark", "design", "concept",
}


# --------------------------------------------------------------- 최종 프롬프트
#
# LLM은 "무엇을 그릴지"(motif/form)만 정하고, 아래 고정 블록은 코드가 붙인다.
# 2026-08-12 이미지 실험 6회에서 얻은 제약이라 LLM 판단에 맡기면 재발한다.

# 팀에서 제안한 마무리 문단
CLOSING = (
    "Create a logo that reflects the brand identity and selected attributes. "
    "Make the design distinctive, balanced, scalable, and visually coherent. "
    "Ensure it is suitable for branding across packaging, digital platforms, "
    "and marketing materials. Keep it clear and not overly cluttered."
)

# 조형 제약. 실측 근거는 아래와 같다.
#   - "one single unified shape"  : 없으면 격자 타일이 나온다 (1차)
#   - 모노라인 / 속 채우지 않기    : 면으로 채우면 일러스트가 된다 (1~2차)
#   - "as few strokes as possible" : 개수 상한("at most three")은 무시된다 (2차)
#   - "continuous line" 금지        : 스피로그래프의 직접 원인이라 아예 안 쓴다 (4차)
MARK_INTEGRITY = (
    "The mark must be one single unified shape — not a pattern, not a tile, "
    "and not a grid of separate scattered elements. "
    "Draw it as fine monoline line art: thin strokes of uniform weight, "
    "open unfilled shapes, with visible empty space inside the form. "
    "Do not fill the silhouette with solid colour. "
    "Draw it with as few strokes as possible — the fewer the better. "
    "Keep it simple enough to stay legible when scaled down to 16 pixels. "
    "Use exactly one colour for every stroke — no second colour, "
    "no lighter or darker variants of it, no shading, no gradients."
)

# 글자가 붙으면서 세로 구성이 되어 마크가 프레임 밖으로 잘리기 시작했다.
# "generous margin around the mark"는 마크만 가리켜, 글자까지 포함한 전체
# 구성에는 적용되지 않는 것으로 읽혔다. 범위를 명시한다.
RENDER = (
    "Render it as clean flat vector artwork on a plain white background. "
    "Keep the entire design fully inside the frame with clear empty space on "
    "all four sides — nothing may touch or cross the edges."
)

NO_TEXT = (
    "Do not draw any letters, words, numbers, or typography of any kind — "
    "the brand name is added separately afterwards."
)

# --typo 경로: 모델이 브랜드명까지 그린다.
#
# 원래 설계는 심볼만 생성하고 브랜드명은 OFL 폰트를 윤곽선으로 변환해 붙이는
# 것이었다(app/services/svg_composer.py). 무료 한글 폰트 상당수가 로고·BI/CI
# 제작에 별도 조항을 두고 있어, 라이선스 검토 전까지는 모델이 함께 그리는
# 방식을 쓰기로 했다.
#
# 위험: 이미지 모델은 한글을 자주 틀린다. 실측에서 "젠마크"가 "첸마크"로
# 나왔다. 브랜드명이 틀린 로고는 그대로 불량품이므로, 한글/영문 정확도를
# 재두고 가야 한다 — 이 스크립트가 그 측정을 위한 것이다.
# 해칭 금지가 핵심이다.
#
# 앞선 지시는 이렇게 읽혔다:
#   "thin strokes of uniform weight" + "do not fill with solid colour"
#   + "visible empty space inside the form"
#   → 가는 선을 촘촘히 그어 면을 만들면 세 조건이 모두 충족된다.
# 그래서 모델이 동심원·나선으로 안을 메웠다. 지시를 어긴 게 아니라 지킨 것이다.
#
# "적게 그려라"(as few strokes as possible)는 세 번 시도해서 세 번 무시됐다.
# 개수는 세게 하기 어려우니, 대신 "안쪽을 비워라"로 바꿔 말한다.
_OUTLINE_ONLY = (
    "Draw the symbol as a plain outline: a stroke of uniform thickness tracing "
    "its silhouette, with the inside left completely empty — nothing but "
    "background shows through it. "
    "Do not add hatching, parallel strokes, concentric repeats, spirals, "
    "nested copies, texture, or any decorative lines inside or around the "
    "shape. The interior must be blank."
)

MARK_INTEGRITY_TYPO = (
    "The symbol must be one single unified shape — not a pattern, not a tile, "
    "and not a grid of separate scattered elements. "
    + _OUTLINE_ONLY +
    " Set the brand name in a clean, evenly spaced typeface, clearly legible, "
    "smaller than the symbol. "
    "Use exactly one colour for everything — no second colour, "
    "no lighter or darker variants of it, no shading, no gradients."
)

WITH_TEXT = (
    'Spell the brand name exactly as "{brand}" — every character must match '
    "exactly. Do not add any other words, letters, numbers, taglines, "
    "or decorative text anywhere in the image."
)

TONE_EN = {
    "friendly": "a friendly, approachable feeling",
    "professional": "a professional, trustworthy feeling",
    "warm": "a delicate, warm, emotional feeling",
    "trendy": "a bold, distinctive, trendy feeling",
    "minimal": "a clean, intuitive, minimal feeling",
}

FALLBACK_INKS = [("charcoal", "#2E2E33"), ("deep navy", "#1E3350")]


def _hex_to_rgb(hx):
    hx = str(hx).lstrip("#")
    if len(hx) == 3:
        hx = "".join(c * 2 for c in hx)
    return [int(hx[i:i + 2], 16) for i in (0, 2, 4)] if len(hx) == 6 else None


WHITE = (255, 255, 255)
# 흰 배경에서 잉크로 쓸 수 있는 최소 밝기 차. 이보다 밝으면 선이 안 보인다.
# 실측: #dde4ff(luma 229)를 그대로 썼더니 시안이 빈 화면으로 나왔다 — 두 번.
MIN_INK_CONTRAST = 90


def ink_pool(raw: dict):
    """시안마다 하나씩 배정할 단색. 사용자가 고른 색을 먼저 쓴다.

    한 로고에 한 색이 원칙이라(브랜딩 정석이자 실측에서 가장 깔끔했다),
    4장을 채우려면 후보가 4개 필요하다. 모자라면 무채색으로 채운다.

    ★ 밝기 가드
      사용자가 톤앤매너에서 고르는 두 색은 '주조색 + 보조색'이라, 보조색은
      배경·여백용으로 아주 밝은 경우가 많다(#dde4ff 등). 그걸 흰 배경 위
      선 색으로 쓰면 로고가 보이지 않는다. 실제로 두 번 연속 시안 2가
      빈 화면으로 나왔다.
      버리지 않고 logo_composer._adjust_for_contrast로 눌러서 쓴다 —
      사용자가 고른 색조는 유지하면서 보이게만 만든다.
    """
    from app.services.prompt_service import _hex_to_color_name
    from app.services.logo_composer import _adjust_for_contrast, _luma

    def usable(hx: str):
        """(이름, HEX) — 너무 밝으면 어둡게 눌러서 돌려준다."""
        rgb = _hex_to_rgb(hx)
        if not rgb:
            return None
        if _luma(WHITE) - _luma(tuple(rgb)) < MIN_INK_CONTRAST:
            rgb = list(_adjust_for_contrast(tuple(rgb), WHITE))
            hx = "#%02X%02X%02X" % tuple(rgb)
        name = _hex_to_color_name(hx)
        return (name, hx) if name else None

    pool, seen = [], set()
    for raw_hex in (raw.get("color1"), raw.get("color2"), raw.get("color3")):
        if not raw_hex or str(raw_hex).lower() in seen:
            continue
        seen.add(str(raw_hex).lower())
        item = usable(str(raw_hex))
        if item and item[1].lower() not in {p[1].lower() for p in pool}:
            pool.append(item)
    pool += [c for c in FALLBACK_INKS
             if c[1].lower() not in {p[1].lower() for p in pool}]
    return pool


def build_final_prompt(raw: dict, data: dict, variant_index: int,
                       slim: bool = False, typo: bool = False):
    """LLM 결과 + 고정 블록 + 색 = Recraft에 들어갈 최종 문장.

    slim=True는 중복을 걷어낸 대조군이다. 첫 조립본에서 이런 중복이 있었다.
      - "plain white background"가 색 문장과 RENDER에 두 번
      - "간결하게"가 concept / tone / CLOSING / 16px 네 번
      - CLOSING 자체가 "distinctive, balanced, scalable" 같은 희망사항이라
        이미지 모델이 실행할 수 있는 시각 지시가 아니다 (효과 미확인)
    프롬프트가 길수록 개별 지시가 희석되므로, 짧은 쪽이 나을 수 있다.
    """
    v = (data.get("variants") or [])[variant_index]
    motif = str(v.get("motif", "")).strip().rstrip(".")
    form = str(v.get("form", "")).strip().rstrip(".")
    concept = str(data.get("concept", "")).strip()

    pool = ink_pool(raw)
    ink = pool[variant_index % len(pool)]
    tone = TONE_EN.get(raw.get("tone", ""), "")

    if typo:
        brand = str(raw.get("company_name") or raw.get("brand_name") or "").strip()
        lines = [
            "Design a logo for a beauty and cosmetics brand.",
            f"The symbol depicts {motif}.",
            f"Arrangement: {form}." if form else "",
            concept,
            f'Below the symbol, set the brand name "{brand}".',
            f"Use {ink[0]} as the only colour.",
            "",
            MARK_INTEGRITY_TYPO,
            RENDER,
            WITH_TEXT.format(brand=brand),
        ]
    elif slim:
        lines = [
            "Design a logo mark for a beauty and cosmetics brand.",
            f"The mark depicts {motif}.",
            f"Arrangement: {form}." if form else "",
            # concept이 이미 톤을 담고 있어 tone 문장은 뺀다
            concept,
            f"Use {ink[0]} as the only colour.",
            "",
            MARK_INTEGRITY,
            RENDER,
            NO_TEXT,
        ]
    else:
        lines = [
            "Design a logo mark for a beauty and cosmetics brand.",
            f"The mark depicts {motif}.",
            f"Arrangement: {form}." if form else "",
            concept,
            f"It should convey {tone}." if tone else "",
            f"Use {ink[0]} as the only colour of the entire mark, "
            f"on a plain white background.",
            "",
            CLOSING,
            MARK_INTEGRITY,
            RENDER,
            NO_TEXT,
        ]
    prompt = "\n".join(x for x in lines if x != "")

    controls = {"colors": [{"rgb": _hex_to_rgb(ink[1])}]}
    return prompt, ink, controls


IMAGE_API = "https://openrouter.ai/api/v1/images"
IMAGE_MODEL = "recraft/recraft-v4-vector"


def generate_images(api_key: str, data: dict, raw: dict, slim: bool, typo: bool = False):
    """최종 프롬프트로 실제 로고를 뽑는다. 시안당 $0.08."""
    import base64

    if typo:
        brand = str(raw.get("company_name") or "").strip()
        # 브랜드명별로 폴더를 나눈다 — 한글/영문을 나란히 두고 비교해야 한다
        safe = re.sub(r"[^\w가-힣-]", "_", brand) or "brand"
        tag = f"typo_{safe}"
    else:
        tag = "slim" if slim else "full"
    out = OUT_DIR / f"images_{tag}"
    out.mkdir(parents=True, exist_ok=True)
    n = len(data.get("variants") or [])

    # 심볼만이면 정사각형, 브랜드명이 아래 붙으면 세로로 여유를 준다.
    # 1:1에 세로 두 덩어리를 넣으려니 마크가 프레임 밖으로 잘렸다.
    # 문장으로 "여백을 두라"고 설득하는 것보다 공간을 주는 편이 확실하다.
    #
    # 다만 Recraft가 받는 비율 목록을 알 수 없어(4:5는 400) 후보를 순서대로
    # 시도하고 전부 거절당하면 1:1로 떨어진다. 실패한 생성은 과금되지 않으므로
    # 이 방식에 비용 위험이 없다.
    ratios = ["4:5", "3:4", "1:1"] if typo else ["1:1"]

    def one(i):
        prompt, ink, controls = build_final_prompt(raw, data, i, slim=slim, typo=typo)
        res = last = None
        for ratio in ratios:
            res = requests.post(
                IMAGE_API,
                headers={"Authorization": f"Bearer {api_key}",
                         "Content-Type": "application/json"},
                json={
                    "model": IMAGE_MODEL,
                    "prompt": prompt,
                    "aspect_ratio": ratio,
                    "provider": {"options": {"recraft": {"controls": controls}}},
                },
                timeout=120,
            )
            if res.ok:
                if ratio != ratios[0]:
                    print(f"   (시안 {i+1}: {ratios[0]} 거절 → {ratio} 사용)", flush=True)
                break
            last = f"HTTP {res.status_code}: {res.text[:160]}"
            if res.status_code != 400 or "aspect_ratio" not in res.text:
                break   # 비율 문제가 아니면 다른 비율로 다시 걸 이유가 없다
        if res is None or not res.ok:
            return i, None, last or "실패"
        d = (res.json().get("data") or [{}])[0]
        if not d.get("b64_json"):
            return i, None, "이미지 없음"
        svg = base64.b64decode(d["b64_json"]).decode("utf-8")
        path = out / f"logo_{i+1}.svg"
        path.write_text(svg, encoding="utf-8")
        return i, path, None

    with ThreadPoolExecutor(max_workers=n) as ex:
        results = sorted(ex.map(one, range(n)))

    print(f"\n   ── 이미지 생성 ({tag}) " + "─" * 40)
    for i, path, err in results:
        if err:
            print(f"   시안 {i+1}: ❌ {err}")
        else:
            paths = len(re.findall(r"<path", path.read_text(encoding="utf-8")))
            # path 60개 초과는 실타래일 확률이 높다 (실측: 성공 14·36 / 실패 107·261·421)
            flag = "⚠️ 과밀" if paths > 60 else "✅"
            print(f"   시안 {i+1}: {flag} path {paths}개 · {path.name}")
    print(f"   저장: {out}")


def judge(data):
    """구조·다양성·구체성을 기계적으로 채점한다."""
    issues = []
    variants = (data or {}).get("variants") or []
    if len(variants) != 4:
        issues.append(f"시안 {len(variants)}개 (4개여야 함)")

    motifs = [str(v.get("motif", "")).lower() for v in variants]
    forms = [str(v.get("form", "")).lower() for v in variants]

    # 사용자가 모양을 지정하면 4개가 같은 사물인 게 정상이다(규칙 3).
    # 그래서 모티프만으로 중복을 재면 안 되고, 배치까지 같을 때만 문제로 본다 —
    # 그건 같은 시안을 네 번 주는 것이기 때문이다.
    pairs = list(zip(motifs, forms))
    if len(set(pairs)) != len(pairs):
        issues.append("모티프+배치가 완전히 같은 시안 있음")
    elif len(set(forms)) != len(forms):
        issues.append("배치 설명이 중복 (시안이 사실상 겹침)")

    def head_noun(motif: str) -> str:
        words = re.findall(r"[a-z]+", motif)
        return words[-1] if words else ""

    vague = [m for m in motifs if head_noun(m) in ABSTRACT_HEADS]
    if vague:
        issues.append(f"추상 중심명사 {len(vague)}건: {vague[0][:40]}")

    # 글자 언급 — 이미지 모델이 글자를 그리게 만드는 직접 원인이다.
    # 브랜드명은 logo_composer가 한글 폰트로 따로 합성하므로, 프롬프트 재료에
    # 워드마크·텍스트가 섞이면 로고에 글자가 두 겹으로 들어간다(실측 확인됨).
    TEXT_WORDS = ("wordmark", "word mark", "brand name", "the word",
                  "text", "letter", "typography", "typeface")
    blob = " ".join(motifs + forms + [str((data or {}).get("concept", ""))]).lower()
    hit = [w for w in TEXT_WORDS if w in blob]
    if hit:
        issues.append(f"글자 언급: {hit[0]} (심볼에 글자가 박힘)")

    for f in forms:
        if "continuous line" in f or "one line" in f:
            issues.append("form에 'continuous line' (실타래 유발)")
            break
    for f in forms:
        if any(w in f for w in ("color", "colour", "gold", "green", "blue")):
            issues.append("form에 색상 언급 (controls와 충돌)")
            break
    return motifs, issues


# ---------------------------------------------------------------- 메인
def main(argv):
    models, dry, do_list, free_only = list(DEFAULT_MODELS), False, False, False
    no_shape = real = raw_mode = False
    gen = None
    i = 0
    while i < len(argv):
        a = argv[i]
        nxt = argv[i + 1] if i + 1 < len(argv) else None
        if a == "--generate":
            gen, real = "full", True
        elif a == "--generate-both":
            gen, real = "both", True
        elif a == "--typo":
            # 모델이 브랜드명까지 그린다. 한글/영문 정확도 측정용.
            gen, real = "typo", True
        elif a == "--brand" and nxt:
            REAL_SURVEY_RAW["company_name"] = nxt
            i += 1
        elif a == "--dry":
            dry = True
        elif a == "--list":
            do_list = True
        elif a == "--free":
            free_only = True
        elif a == "--no-shape":
            no_shape = True
        elif a == "--real":
            real = True
        elif a == "--raw":
            real = raw_mode = True
        elif a == "--models" and i + 1 < len(argv):
            models = [m.strip() for m in argv[i + 1].split(",") if m.strip()]
            i += 1
        i += 1

    if do_list:
        print_models(free_only)
        return 0

    if real:
        # 백엔드가 실제로 보내는 값으로 시험한다.
        # --raw 는 정규화 없이 그대로 던져서, 코드가 먼저 정리해줄 필요가
        # 있는지를 눈으로 확인하기 위한 대조군이다.
        survey = dict(REAL_SURVEY_RAW) if raw_mode else normalize_for_llm(REAL_SURVEY_RAW)
        print(f"※ --real{' --raw' if raw_mode else ''}: 실제 설문 값으로 시험합니다"
              f"{' (정규화 없음 — 대조군)' if raw_mode else ' (id→라벨 정규화, HEX 제외)'}\n")
    else:
        survey = dict(SURVEY)

    # 규칙 3은 "사용자가 모양을 지정했는가"로 갈린다. 지정한 경우만 시험하면
    # 지정하지 않은 쪽(대부분의 사용자)이 검증되지 않는다.
    if no_shape:
        for k in ("원하는 로고 모양", "additional_require"):
            survey.pop(k, None)
        print("※ --no-shape: '원하는 로고 모양'을 비우고 시험합니다 "
              "(모티프 4종이 서로 달라야 정상)\n")

    user_msg = build_user_message(survey)
    if dry:
        print("=" * 70)
        print("[system]\n" + SYSTEM_PROMPT)
        print("=" * 70)
        print("[user]\n" + user_msg)
        print("=" * 70)
        print("\n--dry: 호출하지 않고 종료합니다.")
        return 0

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("OPENROUTER_API_KEY가 없습니다. ai-server/.env를 확인하세요.")
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"모델 {len(models)}개 호출 중...\n", flush=True)

    def run(model):
        try:
            text, elapsed, usage, finish = call_llm(api_key, model, SYSTEM_PROMPT, user_msg)
            return model, text, elapsed, usage, finish, None
        except Exception as e:
            return model, "", 0.0, {}, None, str(e)

    with ThreadPoolExecutor(max_workers=len(models)) as ex:
        results = list(ex.map(run, models))

    lines = ["# LLM 비교 — 프롬프트 생성", ""]
    for model, text, elapsed, usage, finish, err in results:
        # 모델 슬러그의 "/"와 ":"는 파일명에 쓸 수 없다.
        # 특히 Windows에서 ":"는 조용히 NTFS 대체 데이터 스트림으로 새어
        # 파일이 빈 것처럼 보인다 — 실제로 겪은 문제라 여기서 막는다.
        alias = re.sub(r"[^A-Za-z0-9._-]", "_", model)
        print("=" * 70)
        print(f"■ {model}")
        if err:
            print(f"   ❌ {err}")
            lines += [f"## {model}", "", f"실패: {err}", ""]
            continue

        (OUT_DIR / f"{alias}.txt").write_text(text, encoding="utf-8")
        data, strict = extract_json(text)
        if data is None:
            # 왜 실패했는지 보여준다. 응답이 비었는지, 잘렸는지, 설명을 붙였는지에
            # 따라 대응이 완전히 다르다.
            if not text.strip():
                why = "응답이 비어 있음"
            elif finish == "length":
                why = "토큰 한도에서 잘림 (max_tokens 부족)"
            else:
                why = "JSON이 아님"
            print(f"   ❌ 파싱 실패 — {why} · finish_reason={finish} · {len(text)}자")
            print(f"      원문 앞부분: {text[:200]!r}")
            lines += [f"## {model}", "", f"파싱 실패: {why}", "",
                      "```", text[:800], "```", ""]
            continue

        motifs, issues = judge(data)
        tok = usage.get("total_tokens", "?")
        print(f"   {elapsed:.1f}s · {tok} tokens · JSON 순수출력 {'✅' if strict else '❌ (펜스/설명 섞임)'}")
        print(f"   concept: {str(data.get('concept',''))[:80]}")
        for n, m in enumerate(motifs, 1):
            print(f"     {n}. {m[:64]}")
        print(f"   판정: {'✅ 문제 없음' if not issues else '⚠️  ' + ' / '.join(issues)}")

        # Recraft에 실제로 들어갈 문장. LLM 응답만 봐서는 최종 결과를 알 수 없다.
        if real:
            # 저장하는 프롬프트는 실제로 전송할 것과 같아야 한다.
            # 앞서 typo/slim 플래그를 안 넘겨서, 파일에는 full 버전이 저장되고
            # 실제로는 다른 문장이 나가는 상태였다 — 디버깅 때 사람을 속인다.
            is_typo = gen == "typo"
            is_slim = is_typo or gen == "both"
            finals = []
            for n in range(len(data.get("variants") or [])):
                p, ink, ctl = build_final_prompt(
                    REAL_SURVEY_RAW, data, n, slim=is_slim, typo=is_typo
                )
                finals.append(f"[시안 {n+1}] 색 {ink[0]} {ink[1]}  controls={ctl}\n{p}")
            (OUT_DIR / f"{alias}_prompts.txt").write_text(
                "\n\n" + ("\n\n" + "=" * 70 + "\n\n").join(finals), encoding="utf-8"
            )
            print()
            print("   ── Recraft 최종 프롬프트 (시안 1) " + "─" * 30)
            for ln in finals[0].splitlines():
                print(f"   {ln}")
            print(f"   {'─' * 62}")
            print(f"   나머지 시안: {(OUT_DIR / f'{alias}_prompts.txt').name}")

            if gen == "typo":
                generate_images(api_key, data, REAL_SURVEY_RAW, slim=True, typo=True)
            elif gen:
                # full / slim 두 벌을 같은 LLM 결과로 뽑아 프롬프트 길이만 비교한다
                for is_slim in ((False, True) if gen == "both" else (False,)):
                    generate_images(api_key, data, REAL_SURVEY_RAW, is_slim)

        lines += [
            f"## {model}", "",
            f"- {elapsed:.1f}s · {tok} tokens · JSON 순수출력 {'예' if strict else '아니오'}",
            f"- concept: {data.get('concept','')}",
            "- 모티프:",
            *[f"  {n}. {m}" for n, m in enumerate(motifs, 1)],
            f"- 판정: {'문제 없음' if not issues else ' / '.join(issues)}",
            "",
        ]

    (OUT_DIR / "summary.md").write_text("\n".join(lines), encoding="utf-8")
    print("=" * 70)
    print(f"\n결과: {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
