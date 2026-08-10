"""DINOv2 임베딩 추출 + FAISS 인덱스 생성

산출물 (백엔드 요구사항 §6~§8):
  data/faiss/embeddings.npy      float32 (N, 768), 행별 L2 정규화
  data/faiss/ids.csv             임베딩 행 순서 ↔ 출원번호 매핑
  data/faiss/data_manifest.json  건수·모델·체크섬

불변 규칙: trademarks.csv N번째 행 = embeddings.npy N번째 벡터 = ids.csv N번째 출원번호
"""
import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from PIL import Image, ImageOps
from transformers import AutoImageProcessor, AutoModel

BASE = Path(__file__).parent.parent / "data" / "trademarks"
META = BASE / "meta" / "trademarks.csv"
OUT = Path(__file__).parent.parent / "data" / "faiss"
MODEL_ID = os.getenv("DINO_MODEL_ID", "facebook/dinov2-base")
# 재현성: 같은 데이터로 다시 생성해도 동일한 모델 버전을 쓰도록 고정한다.
MODEL_REVISION = os.getenv("DINO_MODEL_REVISION", "f9e44c814b77203eaa57a6bdbbd535f21ede1415")
EMB_DIM = 768
BATCH = 32
KST = timezone(timedelta(hours=9))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_image(path: Path) -> Image.Image:
    """이미지를 RGB로 로드. 투명 배경은 흰색으로 합성한다.

    KIPRIS 상표 이미지는 모두 흰 배경이므로, 쿼리 이미지와 조건을 맞추지 않으면
    투명 영역이 검은색으로 변환되어 임베딩이 어긋난다.
    """
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)  # EXIF 회전 반영
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im)
    return im.convert("RGB")


def main():
    df = pd.read_csv(META, dtype=str)
    print(f"대상 {len(df)}건")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device: {device}")

    processor = AutoImageProcessor.from_pretrained(MODEL_ID, revision=MODEL_REVISION)
    model = AutoModel.from_pretrained(MODEL_ID, revision=MODEL_REVISION).to(device).eval()

    vectors = []
    paths = df["이미지경로"].tolist()

    for i in range(0, len(paths), BATCH):
        batch = [load_image(BASE / p) for p in paths[i:i + BATCH]]
        inputs = processor(images=batch, return_tensors="pt").to(device)
        with torch.no_grad():
            out = model(**inputs)
        # CLS 토큰 = 이미지 전체를 요약한 벡터
        cls = out.last_hidden_state[:, 0, :].cpu().numpy()
        vectors.append(cls)
        print(f"  {min(i + BATCH, len(paths))}/{len(paths)}", end="\r")

    emb = np.vstack(vectors).astype("float32")
    # L2 정규화 → 내적이 곧 코사인 유사도
    norms = np.linalg.norm(emb, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    emb /= norms

    assert emb.shape == (len(df), EMB_DIM), f"shape mismatch: {emb.shape}"
    assert emb.dtype == np.float32
    assert not np.isnan(emb).any() and not np.isinf(emb).any(), "NaN/Inf 포함"

    OUT.mkdir(parents=True, exist_ok=True)
    np.save(OUT / "embeddings.npy", emb)
    df[["출원번호"]].to_csv(OUT / "ids.csv", index=False, encoding="utf-8-sig")

    write_manifest(OUT, META, len(df))

    print(f"\n임베딩 shape: {emb.shape}")
    print(f"저장: {OUT / 'embeddings.npy'}")


def write_manifest(out: Path, meta_csv: Path, record_count: int) -> dict:
    now = datetime.now(KST)
    manifest = {
        "datasetVersion": f"{now:%Y-%m-%d}-v1",
        "recordCount": record_count,
        "embeddingDimension": EMB_DIM,
        "embeddingDtype": "float32",
        "modelId": MODEL_ID,
        "modelRevision": MODEL_REVISION,
        "generatedAt": now.isoformat(),
        "metadataSha256": sha256(meta_csv),
        "embeddingsSha256": sha256(out / "embeddings.npy"),
        "idsSha256": sha256(out / "ids.csv"),
    }
    (out / "data_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"매니페스트 저장: {out / 'data_manifest.json'}")
    return manifest


if __name__ == "__main__":
    main()