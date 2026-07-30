from app.core.logging import logger

class DinoModelLoader:
    def __init__(self):
        self.model = None
        logger.info("Initializing DINOv2 Model Loader...")

    def load_model(self):
        if self.model is None:
            logger.info("Loading DINOv2 feature extractor...")
            self.model = "DINOV2_MODEL_LOADED"
        return self.model

dino_loader = DinoModelLoader()
