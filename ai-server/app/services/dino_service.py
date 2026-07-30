import numpy as np
from typing import List
from app.models.dino_model import dino_loader
from app.core.logging import logger

class DinoService:
    @staticmethod
    def extract_features(image_url: str) -> List[float]:
        logger.info(f"Extracting DINOv2 feature vector for image: {image_url}")
        _ = dino_loader.load_model()
        # Generate dummy 384-dim normalized vector for demonstration
        vec = np.random.randn(384).astype(np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()
