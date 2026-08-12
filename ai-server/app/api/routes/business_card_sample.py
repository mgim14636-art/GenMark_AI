from fastapi import APIRouter, HTTPException

from app.core.logging import logger
from app.schemas.business_card_sample import CardSampleRequest, CardSampleResponse
from app.services.business_card_sample_service import BusinessCardSampleService

# [주의] main.py가 이미 prefix를 붙인다. 여기서는 절대 prefix를 또 지정하지 않는다
# (generation.py, product_mockup.py와 동일한 원칙).
router = APIRouter()


@router.post("/generate-sample", response_model=CardSampleResponse)
def generate_sample(req: CardSampleRequest):
    try:
        result = BusinessCardSampleService.generate_sample(req)
        return CardSampleResponse(**result)
    except Exception as e:
        logger.error(f"Business card sample generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
