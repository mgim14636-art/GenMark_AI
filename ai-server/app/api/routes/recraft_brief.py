"""Recraft 브리프 프롬프트 엔드포인트.

main.py가 이미 prefix(/api/v1/recraft-brief)를 붙이므로, 여기서는
prefix를 절대 따로 지정하지 않는다.
"""
from fastapi import APIRouter, HTTPException

from app.core.logging import logger
from app.schemas.recraft_brief import BriefRequest, BriefResponse
from app.services.recraft_brief_service import RecraftBriefService

router = APIRouter()


@router.post("/generate", response_model=BriefResponse)
def generate_brief(req: BriefRequest):
    try:
        result = RecraftBriefService.generate(req)
        return BriefResponse(**result)
    except Exception as e:
        logger.error(f"Recraft brief generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
