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
            return Image.open(io.BytesIO(src)).convert("RGB")
        if isinstance(src, str) and len(src) > 300:
            if "," in src[:64]:
                src = src.split(",", 1)[1]
            return Image.open(io.BytesIO(base64.b64decode(src))).convert("RGB")
        return Image.open(src).convert("RGB")

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