import base64
from io import BytesIO

from fastapi import APIRouter, HTTPException

from app.core.logging import logger
from app.schemas.generation import GeneratedLogo, GenerationRequest, GenerationResponse
from app.services import flux_service, logo_composer

router = APIRouter()


def _image_to_base64(img) -> str:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@router.post("/generate", response_model=GenerationResponse)
def generate_logo(req: GenerationRequest):
    survey = req.to_survey_dict()
    try:
        # flux_service: 설문 -> prompt_service.build_prompt_from_survey로 프롬프트를
        # 만든 뒤 NVIDIA FLUX.2-klein 호출까지 내부에서 처리해 심볼(도형) 이미지들을 얻는다.
        symbols = flux_service.generate_logo_from_survey(survey, num_variants=req.num_variants)
        # logo_composer: 심볼마다 브랜드명 텍스트 합성 + 배경 정리를 거쳐 최종 로고를 만든다.
        logos = [logo_composer.compose_final_logo(symbol, survey) for symbol in symbols]
        return GenerationResponse(
            logos=[GeneratedLogo(imageBase64=_image_to_base64(logo)) for logo in logos]
        )
    except Exception as e:
        logger.error(f"Logo generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
