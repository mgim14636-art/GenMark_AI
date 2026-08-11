"""임베딩 ↔ 이미지 정합성 진단.

증상: DB에 있는 상표 이미지를 그대로 쿼리로 넣었는데 자기 자신이 1위로 안 잡힌다.
정상이라면 코사인 = 1.0 이어야 한다.

세 가지를 한 번에 구분한다.
  1) 재현성   : 같은 행의 저장 벡터 vs 지금 계산한 벡터의 코사인
                → 1.0 이면 전처리 동일, 낮으면 전처리가 달라졌다는 뜻
  2) 정렬     : 전체에서 가장 가까운 벡터의 인덱스가 그 행과 같은가
                → 다르면 CSV 행 ↔ 임베딩 행 대응이 깨진 것
  3) 되찾기   : 다른 행에 그 이미지의 벡터가 있는지 (오프셋 어긋남 탐지)

사용법
    cd ai-server
    python scripts/diagnose_alignment.py        # 12장
    python scripts/diagnose_alignment.py 30
"""
import os

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def main() -> int:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 12

    from app.core.config import settings
    from app.services.dino_service import DinoService
    from app.vector_store.index_manager import index_manager
    from app.vector_store.metadata_store import metadata_store

    vectors = index_manager.vectors
    root = Path(settings.trademark_data_root)
    paths = metadata_store.column("이미지경로")
    app_nos = metadata_store.column("출원번호")

    print(f"임베딩 {vectors.shape} | 메타 {len(paths)}행\n")

    rng = np.random.default_rng(7)
    picks = rng.choice(len(paths), size=min(n, len(paths)), replace=False)

    print(f"{'행':>6} {'자기벡터 cos':>12} {'최고 cos':>9} {'최고 행':>8} {'일치':>5}  파일")
    print("-" * 92)

    self_cos, matched, offsets = [], 0, []

    for idx in picks:
        img = root / paths[idx]
        if not img.exists():
            print(f"{idx:>6} {'파일없음':>12}")
            continue

        q = np.array(DinoService.extract_features(str(img)), dtype=np.float32)
        scores = vectors @ q
        top = int(np.argmax(scores))
        c_self = float(scores[idx])
        c_top = float(scores[top])

        self_cos.append(c_self)
        ok = top == int(idx)
        matched += ok
        if not ok:
            offsets.append(top - int(idx))

        print(
            f"{idx:>6} {c_self:>12.4f} {c_top:>9.4f} {top:>8} {'O' if ok else 'X':>5}  {img.name}"
        )

    print("-" * 92)
    if not self_cos:
        print("표본 없음")
        return 1

    arr = np.array(self_cos)
    print(f"\n[1] 재현성 — 같은 행의 저장 벡터와 재계산 벡터의 코사인")
    print(f"    중앙값 {np.median(arr):.4f}   최소 {arr.min():.4f}   최대 {arr.max():.4f}")
    if np.median(arr) > 0.99:
        print("    → 전처리 동일. 임베딩 재현됨.")
    elif np.median(arr) > 0.8:
        print("    → ⚠️ 전처리가 미묘하게 다름 (리사이즈·배경합성·EXIF 등)")
    else:
        print("    → ❌ 전혀 다른 벡터. 임베딩이 이 이미지로 만들어지지 않았음.")

    print(f"\n[2] 정렬 — 최고 유사 벡터가 자기 행인 경우: {matched}/{len(self_cos)}")
    if matched == len(self_cos):
        print("    → 행 대응 정상")
    else:
        print("    → ❌ 행 대응 불일치")
        if offsets:
            uniq, cnt = np.unique(offsets, return_counts=True)
            print(f"    어긋난 간격 상위: {list(zip(uniq[np.argsort(-cnt)][:5], sorted(cnt)[::-1][:5]))}")
            if len(set(offsets)) == 1:
                print(f"    → 전체가 {offsets[0]}행씩 밀렸습니다. 일정 오프셋 = 복구 가능")

    print("\n[해석]")
    print("  [1] 높고 [2] 정상  → 정합성 OK. 점수 앵커만 조정하면 됨")
    print("  [1] 낮고 [2] 불일치 → build_index.py 재실행 필요 (임베딩 재생성)")
    print("  [1] 낮고 [2] 정상   → 전처리 차이. dino_service와 build_index 파이프라인을 맞출 것")
    return 0


if __name__ == "__main__":
    sys.exit(main())
