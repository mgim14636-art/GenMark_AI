from fastapi import APIRouter
from app.schemas.embedding import EmbeddingRequest, EmbeddingResponse
from app.services.dino_service import DinoService

router = APIRouter()

@router.post("/extract", response_model=EmbeddingResponse)
def extract_embedding(req: EmbeddingRequest):
    vec = DinoService.extract_features(req.image_url)
    return EmbeddingResponse(
        dimension=len(vec),
        vector=vec
    )
