import torch
from transformers import AutoImageProcessor, AutoModel

from app.core.config import settings
from app.core.logging import logger

# 재현성: 임베딩 생성 시와 동일한 모델·revision을 써야 한다. (계약 §8)
MODEL_ID = settings.model_id
MODEL_REVISION = settings.model_revision


class DinoModelLoader:
    def __init__(self):
        self.processor = None
        self.model = None
        logger.info("Initializing DINOv2 Model Loader...")

    def load_model(self):
        if self.model is None:
            logger.info("Loading DINOv2 %s@%s ...", MODEL_ID, MODEL_REVISION)
            self.processor = AutoImageProcessor.from_pretrained(
                MODEL_ID, revision=MODEL_REVISION
            )
            self.model = AutoModel.from_pretrained(
                MODEL_ID, revision=MODEL_REVISION
            ).eval()
            logger.info("DINOv2 model loaded.")
        return self.processor, self.model


dino_loader = DinoModelLoader()