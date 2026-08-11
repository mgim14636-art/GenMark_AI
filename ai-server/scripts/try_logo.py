"""로고 생성 스모크 테스트.

OpenRouter 이미지 API가 실제로 응답하는지, 폰트 합성까지 끝나는지 한 번에 확인한다.

사용법:
    cd ai-server
    python scripts/try_logo.py              # 1장
    python scripts/try_logo.py 4            # 4장

결과는 data/outputs/logo_try_N.png 로 저장된다.
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
    "brand_name": "GenMark",
    "industry": "뷰티",
    "style": "혼합형",
    "tone": "모던",
    "values": ["자연", "신뢰"],
    "color": "#2E7D6B",
}


def main() -> int:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 1

    from app.services import flux_service, logo_composer

    key = flux_service.OPENROUTER_API_KEY or ""
    print("=" * 60, flush=True)
    print(f"URL   : {flux_service.OPENROUTER_API_URL}", flush=True)
    print(f"MODEL : {flux_service.OPENROUTER_MODEL}", flush=True)
    print(f"KEY   : {key[:8]}... ({len(key)}자)" if key else "KEY   : ❌ 없음", flush=True)
    print(f"시안수 : {n}", flush=True)
    print(f"타임아웃: {flux_service.REQUEST_TIMEOUT}초 x (재시도 {flux_service.MAX_RETRIES}회)", flush=True)
    print("=" * 60, flush=True)

    if not key:
        print("\nOPENROUTER_API_KEY가 없습니다. ai-server/.env를 확인하세요.", flush=True)
        return 1

    print("\n요청 중... (최대 2분, 끊으려면 Ctrl+C)\n", flush=True)
    started = time.time()

    try:
        variants = flux_service.generate_logo_variants(SURVEY, num_variants=n)
        symbols = [v["image"] for v in variants]
    except KeyboardInterrupt:
        print(f"\n사용자가 중단했습니다 ({time.time() - started:.0f}초 경과).", flush=True)
        return 130
    except Exception:
        print(f"\n❌ 생성 실패 ({time.time() - started:.1f}초)\n", flush=True)
        traceback.print_exc()
        return 1

    print(f"\n✅ 심볼 {len(symbols)}장 수신 ({time.time() - started:.1f}초)", flush=True)
    for v in variants:
        print(f"   variantIndex={v['variant_index']}  seed={v['seed']}", flush=True)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for i, symbol in enumerate(symbols, 1):
        logo = logo_composer.compose_final_logo(symbol, SURVEY)
        path = OUT_DIR / f"logo_try_{i}.png"
        logo.save(path)
        print(f"   저장: {path}  {logo.size}", flush=True)

    print(f"\n완료. 폴더 열기: explorer {OUT_DIR}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
