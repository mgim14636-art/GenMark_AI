import base64
from io import BytesIO

from fastapi import APIRouter, HTTPException

from app.core.logging import logger
from app.schemas.generation import GeneratedLogo, GenerationRequest, GenerationResponse
from app.services import logo_gen_service, logo_composer, svg_composer, value_keyword_service

router = APIRouter()


def _image_to_base64(img) -> str:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _compose_svg(variant: dict, survey: dict) -> str | None:
    symbol_svg = variant.get("svg")
    if not symbol_svg:
        return None
    return svg_composer.compose_svg_logo(
        symbol_svg,
        survey,
        variant_index=variant["variant_index"],
    )


@router.post("/generate", response_model=GenerationResponse)
def generate_logo(req: GenerationRequest):
    survey = value_keyword_service.enrich_value_keywords(req.to_survey_dict())
    try:
        # logo_gen_service: 설문 -> prompt_service.build_prompt_from_survey로 프롬프트를
        # 만든 뒤 OpenRouter 이미지 API 호출까지 내부에서 처리해 심볼(도형) 이미지들을 얻는다.
        # variant_offset은 재생성 시 직전 회차와 다른 모티프를 배정받기 위한 값이다.
        variants = logo_gen_service.generate_logo_variants(
            survey,
            num_variants=req.num_variants,
            variant_offset=req.variant_offset,
        )
        # logo_composer: 심볼마다 브랜드명 텍스트 합성 + 배경 정리를 거쳐 최종 로고를 만든다.
        return GenerationResponse(
            logos=[
                GeneratedLogo(
                    imageBase64=_image_to_base64(
                        # variant_index를 넘겨 폰트·자간이 시안마다 다르되
                        # 같은 설문이면 재현되도록 한다.
                        logo_composer.compose_final_logo(
                            v["image"], survey, variant_index=v["variant_index"]
                        )
                    ),
                    seed=v["seed"],
                    variantIndex=v["variant_index"],
                    svg=_compose_svg(v, survey),
                )
                for v in variants
            ]
        )
    except Exception as e:
        logger.error(f"Logo generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
