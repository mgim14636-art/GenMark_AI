"""KIPRIS 벌크 zip → ai-server/data 레이아웃 복원.

임베딩 재생성 없이 검색 가능한 상태를 만든다.

사용법:
    # 1) 이미지 원본 복원 (KIPRIS 벌크 zip 필요)
    python scripts/restore_data.py --kipris-zip /path/KI202608051108150001.zip

    # 2) 인덱스 번들도 함께 복원 (embeddings/ids/manifest/meta)
    python scripts/restore_data.py \
        --kipris-zip /path/KI202608051108150001.zip \
        --index-zip  /path/genmark-index-2026-08-10-v1.zip

    # 검증만 (파일을 쓰지 않음)
    python scripts/restore_data.py --verify-only

복원 후 `GET /health`가 status=ready 를 반환하면 성공이다.
"""
import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path

AI_SERVER = Path(__file__).resolve().parent.parent
DATA = AI_SERVER / "data"
TRADEMARKS = DATA / "trademarks"
META_CSV = TRADEMARKS / "meta" / "trademarks.csv"
FAISS_DIR = DATA / "faiss"
MANIFEST = FAISS_DIR / "data_manifest.json"

# 벌크 zip 안의 원본 위치 → 로컬 배치 위치
DBII = "DBII_000000000000012"
DEST_ROOT = TRADEMARKS / "raw" / "cosmetic_9000" / DBII


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def restore_index(index_zip: Path) -> None:
    print(f"[index] {index_zip.name} 전개 → {AI_SERVER}")
    with zipfile.ZipFile(index_zip) as z:
        z.extractall(AI_SERVER)
    print("[index] 완료")


def restore_images(kipris_zip: Path) -> None:
    import pandas as pd

    if not META_CSV.exists():
        sys.exit(
            f"[error] {META_CSV} 가 없습니다. --index-zip 을 먼저 지정하거나\n"
            f"        scripts/preprocess.py 를 실행하세요."
        )

    df = pd.read_csv(META_CSV, dtype=str, encoding="utf-8-sig")
    need = [p for p in df["이미지경로"].astype(str) if not (TRADEMARKS / p).exists()]
    print(f"[image] 누락 {len(need)}건")
    if not need:
        print("[image] 복원할 것이 없습니다.")
    else:
        (DEST_ROOT / "IMG").mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(kipris_zip) as z:
            zmap = {
                n.split("/")[-1]: n
                for n in z.namelist()
                if "/IMG/" in n and not n.endswith("/")
            }
            miss = [p for p in need if p.split("/")[-1] not in zmap]
            if miss:
                sys.exit(
                    f"[error] zip에 없는 이미지 {len(miss)}건. 다른 벌크 파일입니다.\n"
                    f"        예: {miss[:3]}"
                )
            for rel in need:
                with z.open(zmap[rel.split("/")[-1]]) as src:
                    (TRADEMARKS / rel).write_bytes(src.read())
        print(f"[image] {len(need)}건 복원 완료")

    # TXT 원본도 함께 복원해 preprocess.py 재실행이 가능하도록 한다.
    txt_dir = DEST_ROOT / "TXT"
    txt_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(kipris_zip) as z:
        names = [n for n in z.namelist() if "/TXT/" in n and not n.endswith("/")]
        for n in names:
            with z.open(n) as src:
                (txt_dir / n.split("/")[-1]).write_bytes(src.read())
    print(f"[txt]   {len(names)}개 복원 → {txt_dir}")


def verify() -> int:
    import numpy as np
    import pandas as pd

    problems = []

    for p in (META_CSV, FAISS_DIR / "embeddings.npy", FAISS_DIR / "ids.csv"):
        if not p.exists():
            problems.append(f"필수 파일 없음: {p}")
    if problems:
        for p in problems:
            print("  FAIL", p)
        return 1

    emb = np.load(FAISS_DIR / "embeddings.npy")
    df = pd.read_csv(META_CSV, dtype=str, encoding="utf-8-sig")
    ids = pd.read_csv(FAISS_DIR / "ids.csv", dtype=str, encoding="utf-8-sig")

    checks = [
        ("dtype float32", emb.dtype == np.float32),
        ("shape (N, 768)", emb.ndim == 2 and emb.shape[1] == 768),
        ("NaN/Inf 없음", bool(np.isfinite(emb).all())),
        ("건수 일치", len(df) == len(ids) == emb.shape[0]),
        ("출원번호 중복 없음", df["출원번호"].nunique() == len(df)),
        (
            "csv/ids 순서 일치",
            df["출원번호"].astype(str).str.strip().tolist()
            == ids.iloc[:, 0].astype(str).str.strip().tolist(),
        ),
    ]

    missing_img = sum(
        1 for p in df["이미지경로"].astype(str) if not (TRADEMARKS / p).exists()
    )
    checks.append((f"이미지 전수 존재 (누락 {missing_img})", missing_img == 0))

    if MANIFEST.exists():
        m = json.loads(MANIFEST.read_text(encoding="utf-8"))
        checks.append(("manifest recordCount", m.get("recordCount") == emb.shape[0]))
        checks.append(
            (
                "manifest embeddingsSha256",
                m.get("embeddingsSha256") == sha256(FAISS_DIR / "embeddings.npy"),
            )
        )
        checks.append(
            ("manifest metadataSha256", m.get("metadataSha256") == sha256(META_CSV))
        )
    else:
        print("  WARN data_manifest.json 없음 — 버전 검증 생략")

    failed = 0
    for name, ok in checks:
        print(f"  {'PASS' if ok else 'FAIL'} {name}")
        failed += not ok

    print(f"\n레코드 {emb.shape[0]}건 / 차원 {emb.shape[1]}")
    return 1 if failed else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--kipris-zip", type=Path, help="KIPRIS 벌크 zip 경로")
    ap.add_argument("--index-zip", type=Path, help="인덱스 번들 zip 경로")
    ap.add_argument("--verify-only", action="store_true", help="검증만 수행")
    args = ap.parse_args()

    if not args.verify_only:
        if args.index_zip:
            restore_index(args.index_zip)
        if args.kipris_zip:
            restore_images(args.kipris_zip)
        if not (args.index_zip or args.kipris_zip):
            ap.error("--kipris-zip 또는 --index-zip 중 하나는 필요합니다.")

    print("\n=== 검증 ===")
    code = verify()
    print("\n결과:", "OK — /health 가 ready 를 반환해야 합니다." if code == 0 else "실패")
    sys.exit(code)


if __name__ == "__main__":
    main()
