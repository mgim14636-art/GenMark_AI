from fastapi import APIRouter, HTTPException

from app.core.logging import logger
from app.schemas.business_card_api import BusinessCardRequest, BusinessCardResponse
from app.services.business_card_api_service import BusinessCardService

# main.py가 이미 prefix를 붙인다. 여기서는 prefix를 절대 지정하지 않는다.
router = APIRouter()


@router.post("/generate", response_model=BusinessCardResponse)
def generate_business_card(req: BusinessCardRequest):
    try:
        result = BusinessCardService.generate(req)
        return BusinessCardResponse(**result)
    except Exception as e:
        logger.error(f"Business card generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
