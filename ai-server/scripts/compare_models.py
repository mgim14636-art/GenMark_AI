"""[실험용] 로고 생성 모델 비교.

같은 설문·같은 프롬프트를 여러 모델에 넣어 결과를 나란히 비교한다.
모델 선정 근거를 남기기 위한 도구이며, app/ 아래 서비스 코드는 건드리지 않는다.

사용법:
    cd ai-server
    python scripts/compare_models.py --dry                    # 비용만 계산 (호출 없음)
    python scripts/compare_models.py                          # 기본 2모델 x 4장
    python scripts/compare_models.py --models flux,recraft,recraft-vector
    python scripts/compare_models.py --n 2 --tone warm
    python scripts/compare_models.py --yes                    # 비용 확인 생략
    python scripts/compare_models.py --v1                     # 현행 프롬프트로 비교
    python scripts/compare_models.py --minimal                # 설문값만 (모티프·조형 지시 없음)
    python scripts/compare_models.py --typography             # 모델이 브랜드명까지 그리게
    python scripts/compare_models.py --controls               # Recraft에 RGB·no_text 직접 전달

산출물:
    data/outputs/compare/<모델별칭>/logo_N.png (또는 .svg)
    data/outputs/compare/prompt.txt            실제로 사용한 프롬프트
    data/outputs/compare/compare_sheet.png     비교 시트 (래스터 결과만)

주의:
    - 호출 전에 예상 비용을 보여주고 y/n을 묻는다. 키 소유자의 크레딧이 나가므로
      실수로 큰 금액이 빠지지 않도록 한 단계 둔다.
    - 벡터 모델(SVG)은 PIL로 열 수 없어 .svg로만 저장하고 비교 시트에서는 제외한다.
"""
import os

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import base64
import json
import random
import re
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

OUT_DIR = ROOT / "data" / "outputs" / "compare"
API_URL = "https://openrouter.ai/api/v1/images"
MODELS_API = "https://openrouter.ai/api/v1/images/models"

# 별칭 -> OpenRouter 모델 슬러그.
# vector=True 면 SVG가 돌아와 PIL로 열 수 없다.
# seed=False 인 모델은 시드를 안 받으므로 같은 입력이어도 결과가 매번 달라진다.
MODELS = {
    "flux":            {"slug": "black-forest-labs/flux.2-pro",        "seed": True,  "vector": False, "controls": False},
    "flux-flex":       {"slug": "black-forest-labs/flux.2-flex",       "seed": True,  "vector": False, "controls": False},
    "recraft":         {"slug": "recraft/recraft-v4",                  "seed": False, "vector": False, "controls": True,  "no_text": False},
    "recraft-pro":     {"slug": "recraft/recraft-v4-pro",              "seed": False, "vector": False, "controls": True,  "no_text": False},
    "recraft-vector":  {"slug": "recraft/recraft-v4-vector",           "seed": False, "vector": True,  "controls": True,  "no_text": False},
    "recraft41":       {"slug": "recraft/recraft-v4.1",                "seed": False, "vector": False, "controls": True,  "no_text": False},
    "recraft41-vector": {"slug": "recraft/recraft-v4.1-vector",        "seed": False, "vector": True,  "controls": True,  "no_text": False},
    # no_text는 V3 전용이다. V4 계열에 넣으면 400
    # ("Recraft V4 doesn't support the 'no_text' control") — 실측 확인됨.
    "recraft3":        {"slug": "recraft/recraft-v3",                  "seed": False, "vector": False, "controls": True,  "no_text": True},
}
DEFAULT_MODELS = ["flux", "recraft"]

# OpenRouter 조회 실패 시 쓰는 값 (장당 USD).
# ★ 표시는 2026-08-11에 endpoints API로 직접 확인한 값. 나머지는 추정이므로
# 실제 실행 시 fetch_prices()가 읽어오는 값이 우선한다.
FALLBACK_PRICE = {
    "black-forest-labs/flux.2-pro": 0.032,   # ★ 메가픽셀당 $0.03 x 1:1 1K(1.05MP)
    "black-forest-labs/flux.2-flex": 0.06,
    "recraft/recraft-v4": 0.04,              # ★
    "recraft/recraft-v4-pro": 0.25,          # ★ 주의 — v4의 6배
    "recraft/recraft-v4-vector": 0.08,       # ★
    "recraft/recraft-v4.1": 0.04,
    "recraft/recraft-v4.1-vector": 0.08,
    "recraft/recraft-v3": 0.04,
}

# 장당 단가가 이 값을 넘으면 목록에서 경고를 띄운다
EXPENSIVE_PER_IMAGE = 0.10

# 실제 사용자가 화면에서 고르는 형태에 맞춘 설문.
# company_values_text(서술형 한글)는 _resolve_values가 통째로 버리므로
# (한글 조각이 영문 프롬프트에 박히는 걸 막는 처리) 여기서는 키워드 칩을 쓴다.
# 서술형만 넣고 테스트하면 "브랜드 가치가 프롬프트에 없는 상태"를 비교하게 된다.
SURVEY = {
    "ci_bi": "CI",
    "company_name": "젠마크",
    "industry": "COSMETICS",
    "brand_values": ["클린뷰티", "프리미엄", "감성적"],
    "target_age": "20-30대",
    "tone": "warm",
    "color_mode": "MANUAL",
    "color_manual": ["#4F46E5", "#EC4899"],
    "style": "combination",
}


# --------------------------------------------------------------------- 인자
def parse_args(argv):
    opts = {"n": 4, "models": list(DEFAULT_MODELS), "dry": False, "yes": False,
            "v1": False, "minimal": False, "typography": False, "controls": False,
            "survey": {}}
    i = 0
    while i < len(argv):
        a = argv[i]
        nxt = argv[i + 1] if i + 1 < len(argv) else None
        if a == "--dry":
            opts["dry"] = True
        elif a == "--yes":
            opts["yes"] = True
        elif a == "--v1":
            opts["v1"] = True
        elif a == "--minimal":
            opts["minimal"] = True
        elif a == "--typography":
            opts["typography"] = True
        elif a == "--controls":
            opts["controls"] = True
        elif a == "--n" and nxt:
            opts["n"] = int(nxt); i += 1
        elif a == "--models" and nxt:
            opts["models"] = [m.strip() for m in nxt.split(",") if m.strip()]; i += 1
        elif a == "--tone" and nxt:
            opts["survey"]["tone"] = nxt; i += 1
        elif a == "--brand" and nxt:
            opts["survey"]["company_name"] = nxt; i += 1
        elif a == "--motif" and nxt:
            opts["survey"]["motif_category"] = [nxt]; i += 1
        elif a == "--extra" and nxt:
            opts["survey"]["additional_requirements"] = nxt; i += 1
        i += 1
    return opts


# --------------------------------------------------------------------- 가격
def fetch_prices():
    """OpenRouter에서 현재 단가를 읽어온다. 가격 정책이 바뀌어도 따라가기 위함."""
    prices = dict(FALLBACK_PRICE)
    try:
        res = requests.get(MODELS_API, timeout=15)
        res.raise_for_status()
        wanted = {m["slug"] for m in MODELS.values()}
        for item in res.json().get("data", []):
            if item.get("id") not in wanted:
                continue
            ep = requests.get(
                f"https://openrouter.ai{item['endpoints']}"
                if str(item.get("endpoints", "")).startswith("/")
                else item.get("endpoints", ""),
                timeout=15,
            )
            for e in ep.json().get("endpoints", []):
                for p in e.get("pricing", []):
                    if p.get("billable") != "output_image":
                        continue
                    cost = float(p.get("cost_usd", 0))
                    # 메가픽셀 과금이면 1:1 1K(약 1.05MP) 기준으로 환산
                    prices[item["id"]] = cost * 1.05 if p.get("unit") == "megapixel" else cost
                    break
    except Exception as e:
        print(f"  (단가 조회 실패 — 내장 표 사용: {e})", flush=True)
    return prices


# --------------------------------------------------------------------- 호출
def call_model(api_key: str, slug: str, prompt: str, seed=None, controls=None):
    """반환: (원본 바이트, media_type). SVG도 그대로 통과시킨다.

    controls를 주면 provider.options로 실어 보낸다. Recraft 엔드포인트의
    allowed_passthrough_parameters에 style/controls/text_layout이 있어,
    색상을 RGB로 정확히 지정하고 no_text로 글자 삽입을 차단할 수 있다.
    """
    payload = {"model": slug, "prompt": prompt, "aspect_ratio": "1:1"}
    if seed is not None:
        payload["seed"] = seed
    if controls:
        payload["provider"] = {"options": {"recraft": {"controls": controls}}}

    res = requests.post(
        API_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=120,
    )
    if not res.ok:
        raise RuntimeError(f"HTTP {res.status_code}: {res.text[:300]}")

    data = res.json().get("data", [])
    if not data or not data[0].get("b64_json"):
        raise RuntimeError(f"응답에 이미지가 없습니다: {res.text[:300]}")
    return base64.b64decode(data[0]["b64_json"]), data[0].get("media_type", "")


def ext_for(media_type: str, raw: bytes) -> str:
    """실제 바이트의 매직 넘버로 확장자를 정한다.

    media_type만 믿으면 안 된다 — Recraft는 WEBP를 내려주는데 응답에 media_type이
    비어 있어 .bin으로 저장된 적이 있다(실측 확인됨). 매직 넘버를 먼저 본다.
    """
    if raw[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if raw[:2] == b"\xff\xd8":
        return ".jpg"
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return ".webp"
    if raw.lstrip()[:5] == b"<?xml" or raw.lstrip()[:4] == b"<svg":
        return ".svg"
    if "svg" in (media_type or ""):
        return ".svg"
    if "webp" in (media_type or ""):
        return ".webp"
    if "png" in (media_type or ""):
        return ".png"
    return ".bin"


# --------------------------------------------------------------------- 비교 시트
def build_sheet(results, prompt_note):
    from PIL import Image, ImageDraw, ImageFont

    F = ROOT / "app" / "fonts" / "modern_sans"
    fb = lambda s: ImageFont.truetype(str(F / "bold" / "Pretendard-Bold.ttf"), s)
    fr = lambda s: ImageFont.truetype(str(F / "regular" / "Pretendard-Regular.ttf"), s)

    raster = {".png", ".jpg", ".webp"}
    rows = [(alias, paths) for alias, paths in results.items()
            if any(p.suffix in raster for p in paths)]
    if not rows:
        print("  (래스터 결과가 없어 비교 시트를 만들지 않습니다)")
        return None

    T, PAD, LEFT, HEAD = 340, 14, 230, 96
    cols = max(len(p) for _, p in rows)
    W = LEFT + cols * (T + PAD) + PAD
    H = HEAD + len(rows) * (T + PAD) + 40
    cv = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(cv)
    d.text((16, 24), "로고 생성 모델 비교 — 같은 설문 · 같은 프롬프트", font=fb(28), fill=(28, 32, 42))
    d.text((16, 62), prompt_note, font=fr(17), fill=(130, 138, 150))

    for r, (alias, paths) in enumerate(rows):
        y = HEAD + r * (T + PAD)
        d.text((16, y + T // 2 - 22), alias, font=fb(23), fill=(60, 66, 80))
        d.text((16, y + T // 2 + 8), MODELS[alias]["slug"].split("/")[-1][:24], font=fr(15),
               fill=(150, 156, 168))
        for i, p in enumerate(paths):
            x = LEFT + i * (T + PAD)
            d.rectangle([x, y, x + T, y + T], outline=(226, 230, 238), width=2)
            if p.suffix not in raster:
                d.text((x + T // 2, y + T // 2), p.suffix.upper(), font=fb(26),
                       fill=(190, 60, 90), anchor="mm")
                continue
            im = Image.open(p).convert("RGB")
            im.thumbnail((T - 8, T - 8))
            cv.paste(im, (x + (T - im.width) // 2, y + (T - im.height) // 2))

    out = OUT_DIR / "compare_sheet.png"
    cv.save(out)
    return out


# --------------------------------------------------------------------- 본체
def main() -> int:
    opts = parse_args(sys.argv[1:])
    survey = dict(SURVEY, **opts["survey"])
    n = opts["n"]

    unknown = [m for m in opts["models"] if m not in MODELS]
    if unknown:
        print(f"모르는 모델 별칭: {', '.join(unknown)}")
        print(f"가능: {', '.join(MODELS)}")
        return 1

    # --- 프롬프트 (모델 비교이므로 모든 모델에 같은 문장을 넣는다)
    if opts["v1"]:
        from app.services.prompt_service import build_prompt_from_survey as _b
        build = lambda s, i: _b(s, variant_index=i)
        prompt_kind = "v1 (현행 prompt_service)"
        if opts["typography"]:
            print("⚠️  --typography는 v2에서만 동작합니다. v1은 그대로 진행합니다.\n")
    elif opts["minimal"]:
        from experimental_prompt import build_prompt_minimal as _b
        build = lambda s, i: _b(s, variant_index=i, typography=opts["typography"])
        prompt_kind = "v3 (설문값만 — 모티프·조형 지시 없음)"
    else:
        from experimental_prompt import build_prompt_v2 as _b
        build = lambda s, i: _b(s, variant_index=i, typography=opts["typography"])
        prompt_kind = "v2 (실험 프롬프트)" + (" + 타이포그래피" if opts["typography"] else "")

    prompts = [build(survey, i) for i in range(n)]

    # Recraft controls 생성기 (v2 경로에서만 의미가 있다)
    build_controls = None
    if opts["controls"]:
        if opts["v1"]:
            print("⚠️  --controls는 v2에서만 동작합니다. 무시하고 진행합니다.\n")
            opts["controls"] = False
        else:
            from experimental_prompt import recraft_controls
            from app.services.prompt_service import _normalize_survey, _normalize_tone
            _ns = _normalize_survey(survey)
            _tone = _normalize_tone(_ns.get("tone", ""))
            build_controls = lambda i, allow_no_text: recraft_controls(
                _ns, _tone, i,
                no_text=allow_no_text and not opts["typography"],
            )

    print("=" * 66)
    print("설문")
    for k, v in survey.items():
        print(f"  {k:22} {v}")
    print(f"프롬프트 : {prompt_kind}" + ("  + Recraft controls(RGB 직접 지정" +
          (", no_text)" if not opts["typography"] else ")") if opts["controls"] else ""))
    print("=" * 66)
    print(f"\n▶ variantIndex=0 프롬프트 ({len(prompts[0])}자)\n")
    print(prompts[0])

    # --- 비용 추산
    print("\n" + "=" * 66)
    print("예상 비용")
    prices = fetch_prices()
    total = 0.0
    for alias in opts["models"]:
        spec = MODELS[alias]
        unit = prices.get(spec["slug"], 0.05)
        sub = unit * n
        total += sub
        flags = []
        if spec["vector"]:
            flags.append("SVG")
        if not spec["seed"]:
            flags.append("시드 없음")
        if unit >= EXPENSIVE_PER_IMAGE:
            flags.append("⚠ 고가")
        print(f"  {alias:17} {spec['slug']:34} ${unit:.3f} x {n} = ${sub:.2f}"
              + (f"   [{', '.join(flags)}]" if flags else ""))
    print(f"  {'':17} {'':34} {'합계':>14} ${total:.2f}")
    print("=" * 66)

    if opts["dry"]:
        print("\n--dry 모드: 호출하지 않고 종료합니다.")
        return 0

    from app.services.logo_gen_service import OPENROUTER_API_KEY as KEY
    if not KEY:
        print("\nOPENROUTER_API_KEY가 없습니다. ai-server/.env를 확인하세요.")
        return 1

    if not opts["yes"]:
        try:
            ans = input(f"\n${total:.2f} 를 사용합니다. 진행할까요? [y/N] ").strip().lower()
        except EOFError:
            ans = "n"
        if ans != "y":
            print("취소했습니다.")
            return 0

    # --- 생성
    # 프롬프트 버전마다 폴더를 나눈다. 안 그러면 v2로 뽑아둔 결과를 --minimal 실행이
    # 덮어써서 정작 비교할 대상이 사라진다.
    global OUT_DIR
    OUT_DIR = OUT_DIR / ("v1" if opts["v1"] else "minimal" if opts["minimal"] else "v2")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "prompt.txt").write_text(
        f"# {prompt_kind}\n# survey: {json.dumps(survey, ensure_ascii=False)}\n\n"
        + "\n\n---\n\n".join(f"[variant {i}]\n{p}" for i, p in enumerate(prompts)),
        encoding="utf-8",
    )

    results, timings = {}, {}
    for alias in opts["models"]:
        spec = MODELS[alias]
        d = OUT_DIR / alias
        d.mkdir(parents=True, exist_ok=True)
        print(f"\n── {alias} ({spec['slug']}) 생성 중...", flush=True)
        started = time.time()

        use_controls = opts["controls"] and spec.get("controls")
        if opts["controls"] and not spec.get("controls"):
            print("   (이 모델은 controls를 지원하지 않아 프롬프트만 사용합니다)", flush=True)
        elif use_controls and not spec.get("no_text"):
            print("   (이 모델은 no_text를 지원하지 않아 색상만 지정합니다)", flush=True)

        def one(i):
            seed = random.randint(0, 2_147_483_647) if spec["seed"] else None
            ctrl = build_controls(i, spec.get("no_text", False)) if use_controls else None
            return call_model(KEY, spec["slug"], prompts[i], seed, ctrl)

        paths = []
        with ThreadPoolExecutor(max_workers=min(n, 4)) as ex:
            futures = {ex.submit(one, i): i for i in range(n)}
            for fut, i in futures.items():
                try:
                    raw, mt = fut.result()
                except Exception as e:
                    print(f"   {i + 1}번 실패: {e}", flush=True)
                    continue
                p = d / f"logo_{i + 1}{ext_for(mt, raw)}"
                p.write_bytes(raw)
                paths.append(p)
                print(f"   {p.name}  {len(raw) / 1024:.0f}KB  {mt or '(media_type 없음)'}", flush=True)

        timings[alias] = time.time() - started
        results[alias] = sorted(paths)
        print(f"   {len(paths)}/{n}장  {timings[alias]:.1f}초", flush=True)

    # --- 비교 시트
    print()
    sheet = build_sheet(results, f"{prompt_kind} · 톤 {survey.get('tone')} · {n}시안")
    if sheet:
        print(f"비교 시트: {sheet}")

    print("\n" + "=" * 66)
    print(f"{'모델':17} {'성공':>6} {'소요':>8}   비고")
    for alias in opts["models"]:
        got = len(results.get(alias, []))
        kinds = {}
        for p in results.get(alias, []):
            kinds[p.suffix] = kinds.get(p.suffix, 0) + 1
        note = " ".join(f"{k[1:]} {v}장" for k, v in sorted(kinds.items()))
        print(f"{alias:17} {got:>4}/{n} {timings.get(alias, 0):>7.1f}초   {note}")
    print("=" * 66)
    print(f"\n결과 폴더: {OUT_DIR}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n중단했습니다.")
        sys.exit(130)
    except Exception:
        traceback.print_exc()
        sys.exit(1)
