"""DINOv2 임베딩 추출 + FAISS 인덱스 생성"""
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModel

BASE = Path(__file__).parent.parent / "data" / "trademarks"
META = BASE / "meta" / "trademarks.csv"
OUT = Path(__file__).parent.parent / "data" / "faiss"
MODEL_ID = "facebook/dinov2-base"
BATCH = 32


def load_image(path: Path) -> Image.Image:
    """이미지를 RGB로 로드. 투명 배경은 흰색으로 합성한다.

    KIPRIS 상표 이미지는 모두 흰 배경이므로, 쿼리 이미지와 조건을 맞추지 않으면
    투명 영역이 검은색으로 변환되어 임베딩이 어긋난다.
    """
    im = Image.open(path)
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

    processor = AutoImageProcessor.from_pretrained(MODEL_ID)
    model = AutoModel.from_pretrained(MODEL_ID).to(device).eval()

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
    emb /= np.linalg.norm(emb, axis=1, keepdims=True)

    OUT.mkdir(parents=True, exist_ok=True)
    np.save(OUT / "embeddings.npy", emb)
    df[["출원번호"]].to_csv(OUT / "ids.csv", index=False)

    print(f"\n임베딩 shape: {emb.shape}")
    print(f"저장: {OUT / 'embeddings.npy'}")


if __name__ == "__main__":
    main()