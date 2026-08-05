import base64
import io
from typing import List, Union

import numpy as np
import torch
from PIL import Image

from app.core.logging import logger
from app.models.dino_model import dino_loader


class DinoService:
    @staticmethod
    def _to_image(src: Union[str, bytes]) -> Image.Image:
        if isinstance(src, bytes):
            img = Image.open(io.BytesIO(src))
        elif isinstance(src, str) and len(src) > 300:
            if "," in src[:64]:
                src = src.split(",", 1)[1]
            img = Image.open(io.BytesIO(base64.b64decode(src)))
        else:
            img = Image.open(src)

        # 투명 배경은 흰색으로 합성 — KIPRIS 상표 이미지가 모두 흰 배경이므로
        # 조건을 맞추지 않으면 투명 영역이 검은색으로 변환되어 임베딩이 어긋난다
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
            img = Image.alpha_composite(bg, img)

        return img.convert("RGB")

    @staticmethod
    def extract_features(image_src: Union[str, bytes]) -> List[float]:
        processor, model = dino_loader.load_model()
        image = DinoService._to_image(image_src)

        with torch.no_grad():
            outputs = model(**processor(images=image, return_tensors="pt"))

        vec = outputs.last_hidden_state[:, 0, :].numpy()[0].astype(np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm

        logger.info(f"Feature extracted: dim={vec.shape[0]}")
        return vec.tolist()