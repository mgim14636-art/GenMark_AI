from app.models.openrouter_model import openrouter_loader
from app.models.dino_model import dino_loader
from app.core.logging import logger


class ModelManager:
    @staticmethod
    def preload_all_models():
        logger.info("Preloading all AI models...")
        for name, loader in (("OpenRouter", openrouter_loader), ("DINOv2", dino_loader)):
            try:
                loader.load_model()
                logger.info(f"{name} loaded.")
            except Exception as e:
                logger.error(f"{name} load failed: {e}")
        logger.info("Model preloading finished.")