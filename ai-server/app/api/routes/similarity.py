from fastapi import APIRouter

from app.core.exceptions import (
    CodedHTTPException,
    SimilarityDataNotReady,
    SimilaritySearchFailed,
)
from app.core.logging import logger
from app.core.readiness import get_state
from app.schemas.similarity import SimilarityRequest, SimilarityResponse
from app.services.similarity_service import SimilarityService

router = APIRouter()


@router.post("/search", response_model=SimilarityResponse)
def search(req: SimilarityRequest):
    # 데이터가 없으면 가짜 성공(200 + 빈 matches)을 내지 않고 503으로 끊는다.
    state = get_state()
    if not state.ready:
        raise SimilarityDataNotReady(state.reason or None)

    try:
        return SimilarityService.process_similarity_search(
            req.imageBase64, top_k=req.topK
        )
    except CodedHTTPException:
        # 400/503 등 원인이 분류된 예외는 그대로 전달한다.
        raise
    except Exception as e:
        # imageBase64 원문이 로그에 실리지 않도록 예외 타입/메시지만 남긴다.
        logger.error("Similarity search failed: %s: %s", type(e).__name__, e)
        raise SimilaritySearchFailed()
