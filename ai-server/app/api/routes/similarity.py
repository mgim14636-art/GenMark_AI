from fastapi import APIRouter, HTTPException

from app.core.logging import logger
from app.schemas.similarity import SimilarityRequest, SimilarityResponse
from app.services.similarity_service import SimilarityService

router = APIRouter()

@router.post("/search", response_model=SimilarityResponse)
def search(req: SimilarityRequest):
    try:
        return SimilarityService.process_similarity_search(req.imageBase64, top_k=req.topK)
    except Exception as e:
        logger.error(f"Similarity search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))