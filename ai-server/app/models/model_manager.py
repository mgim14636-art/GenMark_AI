from app.models.flux_model import flux_loader
from app.models.dino_model import dino_loader
from app.core.logging import logger

class ModelManager:
    @staticmethod
    def preload_all_models():
        logger.info("Preloading all AI models...")
        flux_loader.load_model()
        dino_loader.load_model()
        logger.info("All AI models preloaded successfully.")
