"""로고 생성 스모크 테스트.

OpenRouter 이미지 API가 실제로 응답하는지, 폰트 합성까지 끝나는지 한 번에 확인한다.

사용법:
    cd ai-server
    python scripts/try_logo.py                       # 1장
    python scripts/try_logo.py 4                     # 4장
    python scripts/try_logo.py 4 --dry               # 호출 없이 프롬프트만 출력(무료)
    python scripts/try_logo.py 4 --tone 유니크하고 트렌디한 --motif 보석/빛
    python scripts/try_logo.py 2 --extra "물방울과 잎사귀가 겹친 형태"
    python scripts/try_logo.py 4 --dry --v2          # 실험용 프롬프트 v2로 비교(무료)
    python scripts/try_logo.py 4 --v2                # v2로 실제 생성
    python scripts/try_logo.py 4 --v2 --tone warm    # 다른 톤으로 v2 검증
    python scripts/try_logo.py 4 --v2 --typography   # 모델이 브랜드명까지 그리게

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
    "company_name": "젠마크",
    "industry": "COSMETICS",
    "company_values_text": "신뢰, 혁신",
    "tone": "friendly",          # friendly | professional | warm | trendy | minimal
    "color_mode": "MANUAL",
    "color_manual": ["#4F46E5", "#EC4899"],
    "style": "combination",      # symbol | wordmark | combination | lettermark
    "num_variants": 4,
}


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
        elif a == "--motif" and i + 1 < len(argv):
            overrides["motif_category"] = [argv[i + 1]]; i += 1
        elif a == "--extra" and i + 1 < len(argv):
            overrides["additional_requirements"] = argv[i + 1]; i += 1
        elif a.isdigit():
            n = int(a)
        i += 1
    return n, dry, v2, overrides


def main() -> int:
    n, dry, v2, overrides = parse_args(sys.argv[1:])
    survey = dict(SURVEY, **overrides)

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
    tag = "".join(c for c in str(survey.get("tone", "")) if c.isalnum()) or "default"
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
