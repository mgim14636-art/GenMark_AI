import torch
from transformers import AutoImageProcessor, AutoModel

from app.core.logging import logger

MODEL_ID = "facebook/dinov2-base"


class DinoModelLoader:
    def __init__(self):
        self.processor = None
        self.model = None
        logger.info("Initializing DINOv2 Model Loader...")

    def load_model(self):
        if self.model is None:
            logger.info("Loading DINOv2 feature extractor...")
            self.processor = AutoImageProcessor.from_pretrained(MODEL_ID)
            self.model = AutoModel.from_pretrained(MODEL_ID).eval()
            logger.info("DINOv2 model loaded.")
        return self.processor, self.model


dino_loader = DinoModelLoader()