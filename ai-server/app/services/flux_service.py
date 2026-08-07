import uuid
from app.models.flux_model import flux_loader
from app.services.prompt_service import PromptService
from app.core.logging import logger

class FluxService:
    @staticmethod
    def generate_image(prompt: str, width: int = 512, height: int = 512) -> str:
        enhanced_prompt = PromptService.enhance_prompt(prompt)
        logger.info(f"Generating image with enhanced prompt: {enhanced_prompt}")
        _ = flux_loader.load_model()
        # Mock generated image URL for testing/demo
        filename = f"gen_{uuid.uuid4().hex[:8]}.png"
        return f"/uploads/generated/{filename}"
