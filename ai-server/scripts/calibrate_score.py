"""유사도 점수 앵커 캘리브레이션.

점수는 원시 코사인을 COS_ANCHORS로 구간별 선형 매핑해 산출한다.
이 스크립트는 그 앵커가 실제 분포와 맞는지 재측정하고, 어긋나면 새 값을 제안한다.

측정 항목 (모두 top-1 코사인 기준)
  (A) 상한 : DB 상표 이미지를 그대로 쿼리로 넣은 경우 → '사실상 동일'
  (B) 이웃 : 같은 쿼리에서 자기 자신을 뺀 2위        → '등록 상표 간 최근접'
  (C) 하한 : 생성 로고의 1위                        → '무관한 신규 로고'

z 분포도 함께 출력하지만 참고용이다. z는 쿼리별 평균·표준편차로 정규화되어
쿼리 간 비교가 불가능하며, 동일 이미지가 무관한 로고보다 낮은 z를 받는 역전이
실측으로 확인되어 점수 산출에서 제외했다.

사용법
    cd ai-server
    python scripts/calibrate_score.py            # DB 30장 + data/outputs 로고 전부
    python scripts/calibrate_score.py 60         # DB 표본 60장
"""
import os

# Windows torch/faiss OpenMP 충돌 회피
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import statistics
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

SEED = 42
SELF_COS_MIN = 0.999  # 자기 자신으로 간주할 코사인 임계값


def z_of(scores: np.ndarray, idx: int) -> float:
    mu, sd = float(scores.mean()), float(scores.std())
    if sd == 0:
        sd = 1e-6
    return (float(scores[idx]) - mu) / sd


def summarize(name: str, values: list[float]) -> dict:
    if not values:
        print(f"  {name}: 표본 없음")
        return {}
    q = statistics.quantiles(values, n=100) if len(values) >= 3 else None
    out = {
        "n": len(values),
        "min": min(values),
        "med": statistics.median(values),
        "max": max(values),
        "p05": q[4] if q else min(values),
        "p95": q[94] if q else max(values),
    }
    print(
        f"  {name:<22} n={out['n']:<4} "
        f"min={out['min']:5.2f}  p05={out['p05']:5.2f}  "
        f"중앙값={out['med']:5.2f}  p95={out['p95']:5.2f}  max={out['max']:5.2f}"
    )
    return out


def main() -> int:
    n_sample = int(sys.argv[1]) if len(sys.argv) > 1 else 30

    from app.core.config import settings
    from app.core.readiness import get_state
    from app.services.dino_service import DinoService
    from app.services.similarity_service import COS_ANCHORS, _to_score
    from app.vector_store.index_manager import index_manager
    from app.vector_store.metadata_store import metadata_store

    state = get_state(refresh=True)
    if not state.ready:
        print(f"데이터 미준비: {state.reason}")
        return 1

    vectors = index_manager.vectors
    root = Path(settings.trademark_data_root)
    paths = metadata_store.column("이미지경로")

    rng = np.random.default_rng(SEED)
    picks = rng.choice(len(paths), size=min(n_sample, len(paths)), replace=False)

    print("=" * 78)
    anchors = " → ".join(f"{c:.2f}:{s:.0f}점" for c, s in COS_ANCHORS)
    print(f"캘리브레이션  |  DB {len(paths)}건 중 {len(picks)}장 표본")
    print(f"현재 앵커(코사인)  {anchors}")
    print("=" * 78)

    self_z, neighbor_z = [], []
    self_cos, neighbor_cos = [], []
    started = time.time()

    for i, idx in enumerate(picks, 1):
        img_path = root / paths[idx]
        if not img_path.exists():
            continue
        try:
            vec = np.array(DinoService.extract_features(str(img_path)), dtype=np.float32)
        except Exception as e:
            print(f"  건너뜀 {img_path.name}: {type(e).__name__}")
            continue

        scores = vectors @ vec
        order = np.argsort(scores)[::-1]

        top = int(order[0])
        self_z.append(z_of(scores, top))
        self_cos.append(float(scores[top]))

        # 자기 자신(코사인 ~1.0)을 제외한 첫 이웃
        for cand in order:
            if float(scores[cand]) < SELF_COS_MIN:
                neighbor_z.append(z_of(scores, int(cand)))
                neighbor_cos.append(float(scores[int(cand)]))
                break

        if i % 10 == 0:
            print(f"  ... {i}/{len(picks)} ({time.time() - started:.0f}초)", flush=True)

    # 생성 로고
    out_dir = ROOT / "data" / "outputs"
    gen_paths = sorted(out_dir.glob("logo_*.png")) + sorted((out_dir / "samples").glob("gen_*.png"))
    gen_paths = [p for p in gen_paths if "similarity_report" not in p.name]
    print(f"\n생성 로고 표본: {len(gen_paths)}장", flush=True)
    gen_z, gen_cos = [], []
    by_style: dict[str, list[float]] = {}
    for p in gen_paths:
        try:
            vec = np.array(DinoService.extract_features(str(p)), dtype=np.float32)
        except Exception:
            continue
        scores = vectors @ vec
        top = int(np.argmax(scores))
        gen_z.append(z_of(scores, top))
        c = float(scores[top])
        gen_cos.append(c)
        # gen_0001_혼합형_친근하고.png → 스타일 추출
        parts = p.stem.split("_")
        style = parts[2] if len(parts) >= 3 else "미분류"
        by_style.setdefault(style, []).append(c)

    print(f"\n[z 분포 — 현재 방식: 쿼리별 mu/sd]  ({time.time() - started:.0f}초)")
    a = summarize("(A) 동일 이미지", self_z)
    b = summarize("(B) 등록상표 최근접", neighbor_z)
    c = summarize("(C) 생성 로고", gen_z)

    print("\n[원시 코사인 분포 — 쿼리 간 비교 가능한 값]")
    ca = summarize("(A) 동일 이미지", self_cos)
    cb = summarize("(B) 등록상표 최근접", neighbor_cos)
    cc = summarize("(C) 생성 로고", gen_cos)

    if len(by_style) > 1:
        print("\n[스타일별 top-1 코사인]  DB는 '도형복합' 1종뿐이므로 편향 여부를 확인한다")
        for style in sorted(by_style, key=lambda s: -statistics.median(by_style[s])):
            summarize(f"  {style}", by_style[style])
        meds = {s: statistics.median(v) for s, v in by_style.items()}
        hi, lo = max(meds, key=meds.get), min(meds, key=meds.get)
        gap = meds[hi] - meds[lo]
        print(f"\n  최고 {hi}({meds[hi]:.3f}) - 최저 {lo}({meds[lo]:.3f}) = 차이 {gap:.3f}")
        if gap >= 0.05:
            print("  → ⚠️ 스타일에 따라 점수가 계통적으로 다릅니다.")
            print("     같은 위험도라도 스타일 때문에 등급이 갈릴 수 있으므로,")
            print("     혼합형(combination)만 분석 대상으로 제한하거나 스타일별 앵커가 필요합니다.")
        else:
            print("  → 스타일 간 편향은 크지 않습니다. 단일 앵커로 무방합니다.")

    # 앵커 제안은 '분석 대상 스타일'만으로 산출한다.
    # 워드마크·레터마크는 도형이 없어 API에서 422로 거절되므로 분포에 넣으면 안 된다.
    TEXT_ONLY = {"워드마크", "레터마크"}
    graphic = [c for s, v in by_style.items() if s not in TEXT_ONLY for c in v]
    if graphic:
        print("\n[분석 대상 스타일만] 문자 전용(워드마크·레터마크) 제외")
        cg = summarize("  심볼+혼합형", graphic)
    else:
        cg = cc

    if ca and cg and cg["med"] < 1.0:
        # 무관한 생성 로고 → 20점, 동일 이미지(cos=1.0) → 100점 선형
        lo, hi = cg["med"], 1.0
        slope = (100 - 20) / (hi - lo)
        intercept = 20 - slope * lo
        print("\n" + "=" * 78)
        print("[코사인 직접 매핑 제안]  무관 생성로고 → 20점, 동일 → 100점")
        print(f"  score = round(clamp({slope:.1f} * cos {intercept:+.1f}, 0, 100))")
        print(f"  경계:  30점 → cos {(30 - intercept) / slope:.3f}")
        print(f"         60점 → cos {(60 - intercept) / slope:.3f}")

        def s_of(x):
            return int(round(min(100.0, max(0.0, slope * x + intercept))))

        from collections import Counter

        band = lambda x: "SAFE" if x < 30 else ("MODERATE" if x < 60 else "CAUTION")
        print("\n  적용 결과:")
        for label, vals in (
            ("(A) 동일", self_cos),
            ("(B) 최근접", neighbor_cos),
            ("(C) 생성로고 전체", gen_cos),
            ("(C') 분석대상만", graphic or gen_cos),
        ):
            if not vals:
                continue
            s = [s_of(v) for v in vals]
            d = Counter(band(x) for x in s)
            print(
                f"    {label:<12} 중앙값 {statistics.median(s):5.1f}점  범위 {min(s)}~{max(s)}  "
                f"| SAFE {d.get('SAFE',0)} / MOD {d.get('MODERATE',0)} / CAU {d.get('CAUTION',0)}"
            )
        print("=" * 78)

    print("\n[현재 점수식 적용 결과]  (코사인 입력)")
    for label, vals in (
        ("(A) 동일", self_cos),
        ("(B) 최근접", neighbor_cos),
        ("(C) 생성로고 전체", gen_cos),
        ("(C') 분석대상만", graphic or gen_cos),
    ):
        if not vals:
            continue
        s = [_to_score(v) for v in vals]
        band = lambda x: "SAFE" if x < 30 else ("MODERATE" if x < 60 else "CAUTION")
        from collections import Counter

        dist = Counter(band(x) for x in s)
        print(
            f"  {label:<12} 중앙값 {statistics.median(s):5.1f}점  "
            f"범위 {min(s)}~{max(s)}  "
            f"| SAFE {dist.get('SAFE',0)} / MOD {dist.get('MODERATE',0)} / CAU {dist.get('CAUTION',0)}"
        )

    # z 기반 앵커 제안은 제거했다. z는 쿼리별 mu/sd에 의존해 쿼리 간 비교가
    # 불가능하며, 실측 결과 동일 이미지가 무관 로고보다 낮은 z를 받는 역전이 확인됐다.
    # 점수는 원시 코사인으로 매핑해야 한다. (위 [코사인 직접 매핑 제안] 참고)

    return 0


if __name__ == "__main__":
    sys.exit(main())
