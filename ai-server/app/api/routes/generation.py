from fastapi import APIRouter
from app.schemas.generation import GenerationRequest, GenerationResponse
from app.services.flux_service import FluxService

router = APIRouter()

@router.post("/generate", response_model=GenerationResponse)
def generate_logo(req: GenerationRequest):
    img_url = FluxService.generate_image(req.prompt, req.width, req.height)
    return GenerationResponse(
        image_url=img_url,
        status="COMPLETED",
        prompt=req.prompt
    )
