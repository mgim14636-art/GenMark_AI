from app.core.logging import logger

class FluxModelLoader:
    def __init__(self):
        self.model = None
        logger.info("Initializing FLUX Model Loader...")

    def load_model(self):
        if self.model is None:
            logger.info("Loading FLUX pipeline...")
            self.model = "FLUX_PIPELINE_LOADED"
        return self.model

flux_loader = FluxModelLoader()
