from fastapi import APIRouter
from app.schemas.similarity import SimilarityRequest, SimilarityResponse
from app.services.similarity_service import SimilarityService

router = APIRouter()

@router.post("/search", response_model=SimilarityResponse)
def search_similarity(req: SimilarityRequest):
    matches = SimilarityService.process_similarity_search(req.image_url, req.top_k)
    return SimilarityResponse(
        image_url=req.image_url,
        matches=matches
    )
