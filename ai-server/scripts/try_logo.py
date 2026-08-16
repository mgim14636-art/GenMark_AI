"""로고 생성 스모크 테스트.

OpenRouter 이미지 API가 실제로 응답하는지, 폰트 합성까지 끝나는지 한 번에 확인한다.

사용법:
    cd ai-server
    python scripts/try_logo.py                       # 1장
    python scripts/try_logo.py 4                     # 4장
    python scripts/try_logo.py 4 --dry               # 호출 없이 프롬프트만 출력(무료)
    python scripts/try_logo.py 4 --tone 유니크하고 트렌디한 --motif 보석/빛
    python scripts/try_logo.py 2 --extra "물방울과 잎사귀가 겹친 형태"
    python scripts/try_logo.py 4 --color "#0f5f66" --finish outline   # 단색 + 선 스타일
    python scripts/try_logo.py 4 --dry --v2          # 실험용 프롬프트 v2로 비교(무료)
    python scripts/try_logo.py 4 --v2                # v2로 실제 생성
    python scripts/try_logo.py 4 --v2 --tone warm    # 다른 톤으로 v2 검증
    python scripts/try_logo.py 4 --v2 --typography   # 모델이 브랜드명까지 그리게
    python scripts/try_logo.py 4 --random            # 설문 전 항목을 무작위로 (매번 다름)
    python scripts/try_logo.py 4 --random --dry      # 무작위 설문의 프롬프트만 확인(무료)
    python scripts/try_logo.py 4 --random --seed 7   # 같은 seed면 같은 설문 (재현용)

설문 값은 백엔드 CiProject.toSurvey()가 실제로 보내는 키 구성과 동일하게 맞춰 두었다.
스크립트 전용 키(brand_name/values/color 등)를 쓰면 prompt_service가 조용히 무시해
실제 서비스와 다른 프롬프트로 테스트하게 된다(실측 확인됨).

결과 파일명에는 버전과 톤이 들어간다 — 조합을 바꿔가며 여러 번 돌려도
앞선 결과가 덮어써지지 않게 하기 위함이다.
    v1 : data/outputs/logo_try_<톤>_N.png
    v2 : data/outputs/logo_v2_<톤>_N.png
(try_similarity.py는 logo_try_*.png 를 훑으므로 v1 결과는 그대로 잡힌다.)
"""
import os

# Windows torch/faiss OpenMP 충돌 회피 (try_similarity.py 주석 참고)
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import sys
import time
import traceback
from pathlib import Path

# ai-server 루트를 import 경로에 올린다 (app 패키지를 찾기 위해)
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

OUT_DIR = ROOT / "data" / "outputs"

SURVEY = {
    "ci_bi": "CI",
    "company_name": "루나",
    "industry": "COSMETICS",
    # 사전에 등록된 칩 이름으로 적어야 프롬프트에 실린다.
    # 모르는 한글 서술은 _resolve_values가 통째로 버린다(실측 확인됨).
    "company_values_text": "비건, 클린뷰티",
    "tone": "minimal",           # friendly | professional | warm | trendy | minimal
    "color_mode": "MANUAL",
    "color_manual": ["#396FC8", "#DDE4FF"],
    "style": "combination",      # symbol | wordmark | combination | lettermark
    # 필드 라벨("로고형태 :")은 빼고 내용만 적는다 — 라벨까지 프롬프트에 실린다
    "additional_requirements": "달 모양",
    "num_variants": 4,
}


# --random 용 후보 풀. 값은 전부 prompt_service가 실제로 아는 것만 넣는다
# (모르는 값을 넣으면 조용히 기본값으로 떨어져 무엇을 테스트했는지 알 수 없게 된다).
_R = {
    "brand": ["루나", "포레", "미르", "하루", "온새미로", "블랑쉬", "여울", "코코니",
              "달빛정원", "소요", "이든", "라온"],
    "tone": ["friendly", "professional", "warm", "trendy", "minimal"],
    "style": ["symbol", "wordmark", "combination", "lettermark"],
    "target_age": ["10-20", "20-30", "30-40", "40-50", "ALL"],
    "values_text": ["혁신적인", "자연에서 온 순수함", "군더더기 없는 기본",
                    "매일 쓰는 편안함", "믿을 수 있는 성분", "실험적이고 대담한"],
    "chips": ["vegan", "lowIrritation", "cleanBeauty", "natural", "premium",
              "sustainable", "scientific", "reasonable"],
    "extra": ["로고형태 : 달모양", "로고형태 : 물방울", "로고형태 : 잎사귀 두 장",
              "로고형태 : 보석", "로고형태 : 파도", "로고형태 : 씨앗",
              "로고형태 : 원 안의 초승달", "", ""],
    "colors": [
        ["#396FC8", "#DDE4FF"], ["#1F2937", "#9CA3AF"], ["#0F766E", "#5EEAD4"],
        ["#7C3AED", "#DDD6FE"], ["#B45309", "#FDE68A"], ["#BE123C", "#FECDD3"],
        ["#065F46", "#A7F3D0"], ["#4338CA", "#C7D2FE"],
    ],
}


def random_survey(rnd) -> dict:
    """스키마가 실제로 받는 필드명으로만 채운 무작위 설문을 만든다."""
    ci = rnd.random() < 0.5
    sv = {
        "ci_bi": "CI" if ci else "BI",
        "industry": "COSMETICS",
        "tone": rnd.choice(_R["tone"]),
        "style": rnd.choice(_R["style"]),
        "num_variants": 4,
    }
    name = rnd.choice(_R["brand"])
    if ci:
        sv["company_name"] = name
        sv["company_values_text"] = rnd.choice(_R["values_text"])
    else:
        sv["brand_name"] = name
        sv["brand_values"] = rnd.sample(_R["chips"], rnd.randint(1, 3))
        sv["target_age"] = rnd.choice(_R["target_age"])

    if rnd.random() < 0.75:
        sv["color_mode"] = "manual"
        sv["color_manual"] = rnd.choice(_R["colors"])
    else:
        sv["color_mode"] = "ai"      # 톤 기반 자동 추천 경로도 섞어서 확인

    extra = rnd.choice(_R["extra"])
    if extra:
        sv["additional_requirements"] = extra
    return sv


def parse_args(argv: list[str]) -> tuple[int, bool, bool, dict]:
    """개수 + --dry + --v2 + 설문 덮어쓰기 옵션을 읽는다."""
    n, dry, v2, overrides = 1, False, False, {}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--dry":
            dry = True
        elif a == "--v2":
            v2 = True
        elif a == "--typography":
            overrides["_typography"] = True
        elif a == "--tone" and i + 1 < len(argv):
            overrides["tone"] = argv[i + 1]; i += 1
        elif a == "--style" and i + 1 < len(argv):
            overrides["style"] = argv[i + 1]; i += 1
        elif a == "--brand" and i + 1 < len(argv):
            overrides["company_name"] = argv[i + 1]; i += 1
        elif a == "--color" and i + 1 < len(argv):
            # 단색 검증용. 색을 하나만 주면 force_single_color가 결과 SVG의
            # 모든 fill/stroke를 그 색으로 통일한다.
            overrides["color_manual"] = [c.strip() for c in argv[i + 1].split(",") if c.strip()]
            overrides["color_mode"] = "MANUAL"
            i += 1
        elif a == "--finish" and i + 1 < len(argv):
            overrides["logo_finish"] = argv[i + 1]; i += 1
        elif a == "--motif" and i + 1 < len(argv):
            overrides["motif_category"] = [argv[i + 1]]; i += 1
        elif a == "--extra" and i + 1 < len(argv):
            overrides["additional_requirements"] = argv[i + 1]; i += 1
        elif a == "--random":
            overrides["_random"] = True
        elif a == "--seed" and i + 1 < len(argv):
            overrides["_seed"] = int(argv[i + 1]); i += 1
        elif a.isdigit():
            n = int(a)
        i += 1
    return n, dry, v2, overrides


def main() -> int:
    n, dry, v2, overrides = parse_args(sys.argv[1:])

    use_random = overrides.pop("_random", False)
    rnd_seed = overrides.pop("_seed", None)
    if use_random:
        import random as _rnd_mod

        rnd = _rnd_mod.Random(rnd_seed)
        base = random_survey(rnd)
        base["num_variants"] = n
        if rnd_seed is not None:
            print(f"※ --random (seed={rnd_seed}) — 같은 seed면 같은 설문이 나옵니다\n", flush=True)
        else:
            print("※ --random — 매 실행마다 다른 설문. 재현하려면 --seed N 을 쓰세요\n", flush=True)
    else:
        base = SURVEY
    survey = dict(base, **overrides)

    from app.services import logo_gen_service, logo_composer
    from app.services.prompt_service import (
        MOTIF_CATEGORY_MAP,
        TONE_MAP,
        _normalize_tone,
        _CURRENT_SURVEY_ALIASES,
        build_prompt_from_survey,
    )

    if v2:
        # 실험용 조립기. app/ 아래 서비스 코드는 건드리지 않는다.
        from experimental_prompt import build_prompt_v2

        typo = bool(survey.pop("_typography", False))
        if typo:
            # 모델이 브랜드명을 직접 그리므로 logo_composer의 텍스트 합성을 끈다.
            # 안 그러면 "젠마크"가 두 번 들어간다.
            survey["include_brand_name_in_logo"] = False
            print("※ --typography: 모델이 브랜드명을 그립니다 (폰트 합성 생략)\n", flush=True)
        build_prompt = lambda sv, variant_index: build_prompt_v2(
            sv, variant_index=variant_index, typography=typo
        )
        print("※ 실험용 프롬프트 v2 사용 (scripts/experimental_prompt.py)\n", flush=True)
    else:
        survey.pop("_typography", None)
        build_prompt = build_prompt_from_survey

    # 지원하지 않는 톤·모티프를 넣으면 prompt_service가 조용히 기본값으로 떨어진다.
    # 결과만 보고는 알 수 없어서, 요청 전에 여기서 짚어준다.
    tone_key = _normalize_tone(
        _CURRENT_SURVEY_ALIASES["tone"].get(survey.get("tone"), survey.get("tone", ""))
    )
    if tone_key not in TONE_MAP:
        print(f"⚠️  톤 '{survey.get('tone')}'은 지원 목록에 없어 기본 문구로 대체됩니다.", flush=True)
        print(f"    가능: {', '.join(_CURRENT_SURVEY_ALIASES['tone'])} "
              f"또는 {', '.join(TONE_MAP)}\n", flush=True)
    for cat in survey.get("motif_category") or []:
        if cat not in MOTIF_CATEGORY_MAP:
            print(f"⚠️  모티프 '{cat}'은 없는 카테고리라 무시됩니다.", flush=True)
            print(f"    가능: {', '.join(MOTIF_CATEGORY_MAP)}\n", flush=True)

    # 실제로 모델에 들어간 문장. 결과가 이상할 때 프롬프트부터 봐야 하므로 항상 남긴다.
    print("=" * 60, flush=True)
    print("설문", flush=True)
    for k, v in survey.items():
        print(f"  {k:24} {v}", flush=True)
    print("=" * 60, flush=True)
    for i in range(n):
        prompt = build_prompt(survey, variant_index=i)
        print(f"\n▶ variantIndex={i}  프롬프트 ({len(prompt)}자)", flush=True)
        print(f"  {prompt}", flush=True)
    print()

    if dry:
        print("--dry 모드: API를 호출하지 않고 종료합니다.", flush=True)
        return 0

    key = logo_gen_service.OPENROUTER_API_KEY or ""
    print("=" * 60, flush=True)
    print(f"URL   : {logo_gen_service.OPENROUTER_API_URL}", flush=True)
    print(f"MODEL : {logo_gen_service.OPENROUTER_MODEL}", flush=True)
    print(f"KEY   : {key[:8]}... ({len(key)}자)" if key else "KEY   : ❌ 없음", flush=True)
    print(f"시안수 : {n}", flush=True)
    print(f"벡터   : {'SVG 출력' if logo_gen_service.is_vector() else 'PNG 출력'}"
          f" / 시드 {'지원' if logo_gen_service.supports_seed() else '미지원'}", flush=True)
    print(f"타임아웃: {logo_gen_service.REQUEST_TIMEOUT}초 x (재시도 {logo_gen_service.MAX_RETRIES}회)", flush=True)
    print("=" * 60, flush=True)

    if not key:
        print("\nOPENROUTER_API_KEY가 없습니다. ai-server/.env를 확인하세요.", flush=True)
        return 1

    print("\n요청 중... (최대 2분, 끊으려면 Ctrl+C)\n", flush=True)
    started = time.time()

    try:
        if v2:
            # generate_logo_variants는 내부에서 v1 조립기를 부르므로, v2는 프롬프트를
            # 직접 만들어 호출부를 우회한다(서비스 코드 수정 없이 비교하기 위함).
            from concurrent.futures import ThreadPoolExecutor
            import random as _random

            prompts = [build_prompt(survey, variant_index=i) for i in range(n)]
            seeds = [_random.randint(0, 2_147_483_647) for _ in range(n)]
            with ThreadPoolExecutor(max_workers=n) as ex:
                # _call_image_api는 (PIL 이미지, SVG 문자열|None)을 돌려준다
                results = list(ex.map(logo_gen_service._call_image_api, prompts, seeds))
            variants = [
                {
                    "image": img,
                    "svg": svg,
                    "seed": seeds[i] if logo_gen_service.supports_seed() else None,
                    "variant_index": i,
                }
                for i, (img, svg) in enumerate(results)
            ]
        else:
            variants = logo_gen_service.generate_logo_variants(survey, num_variants=n)
        symbols = [v["image"] for v in variants]
    except KeyboardInterrupt:
        print(f"\n사용자가 중단했습니다 ({time.time() - started:.0f}초 경과).", flush=True)
        return 130
    except Exception:
        print(f"\n❌ 생성 실패 ({time.time() - started:.1f}초)\n", flush=True)
        traceback.print_exc()
        return 1

    elapsed = time.time() - started
    print(f"\n✅ 심볼 {len(symbols)}장 수신 ({elapsed:.1f}초)", flush=True)
    print(f"   시안 1장당 평균 {elapsed / max(len(symbols), 1):.1f}초 "
          f"(병렬 호출이므로 순차 대비 약 {len(symbols)}배 단축)", flush=True)
    for v in variants:
        seed = v["seed"] if v["seed"] is not None else "-(모델 미지원)"
        print(f"   variantIndex={v['variant_index']}  seed={seed}", flush=True)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # 톤을 파일명에 넣어 조합별 결과가 서로를 덮어쓰지 않게 한다
    # 무작위 설문으로 여러 번 돌려도 앞선 결과가 덮이지 않게 브랜드명·스타일까지 넣는다
    _name = survey.get("company_name") or survey.get("brand_name") or ""
    tag = "_".join(
        "".join(c for c in str(part) if c.isalnum())
        for part in (_name, survey.get("style", ""), survey.get("tone", ""))
        if part
    ) or "default"
    prefix = "logo_v2" if v2 else "logo_try"
    for i, v in enumerate(variants, 1):
        symbol = v["image"]
        try:
            logo = logo_composer.compose_final_logo(symbol, survey, variant_index=i - 1)
        except Exception as e:
            # 합성이 실패해도 원본은 남긴다 — 소요 시간 측정이 날아가지 않게 한다
            print(f"   ⚠️ 폰트 합성 실패, 원본 저장: {e}", flush=True)
            logo = symbol
        path = OUT_DIR / f"{prefix}_{tag}_{i}.png"
        logo.save(path)
        print(f"   저장: {path}  {logo.size}", flush=True)

        # 벡터 모델이면 SVG 원본도 남긴다 (다운로드·편집용)
        if v.get("svg"):
            svg_path = OUT_DIR / f"{prefix}_{tag}_{i}.svg"
            svg_path.write_text(v["svg"], encoding="utf-8")
            print(f"   저장: {svg_path}", flush=True)

    print(f"\n완료. 폴더 열기: explorer {OUT_DIR}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
