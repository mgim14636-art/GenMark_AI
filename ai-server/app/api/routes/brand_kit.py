"""브랜드킷(F14) 엔드포인트.

백엔드가 app.ai.brand-kit-path 설정값으로 호출한다. 경로는 요청서 3-2 제안대로
/api/v1/generation/brand-kit 이며, generation 라우터와 같은 prefix에 마운트된다.
"""
from fastapi import APIRouter

from app.core.exceptions import BrandKitCompositionFailed, CodedHTTPException
from app.core.logging import logger
from app.schemas.brand_kit import BrandKitRequest, BrandKitResponse
from app.services import brand_kit_service

router = APIRouter()


@router.post("/brand-kit", response_model=BrandKitResponse)
def create_brand_kit(req: BrandKitRequest):
    try:
        result = brand_kit_service.create_brand_kit(req)
    except CodedHTTPException:
        # 입력 문제(400)는 그대로 백엔드에 전달한다 — 재시도해도 소용없는 케이스다.
        raise
    except Exception as e:
        logger.error("Brand kit composition failed: %s", e)
        raise BrandKitCompositionFailed(str(e))

    logger.info(
        "brand-kit %s -> %dx%d (%dms, preliminary=%s)",
        result.kitType,
        result.images[0].width,
        result.images[0].height,
        result.elapsedMs,
        result.preliminary,
    )
    return result
