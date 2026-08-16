import base64
from io import BytesIO

from fastapi import APIRouter, HTTPException

from app.core.logging import logger
from app.schemas.generation import (
    GeneratedLogo,
    GenerationRequest,
    GenerationResponse,
    SvgRasterizeRequest,
    SvgRasterizeResponse,
)
from app.services import (
    logo_gen_service,
    logo_composer,
    motif_translation_service,
    svg_composer,
    svg_rasterization_service,
    value_keyword_service,
)
from app.services.prompt_service import _normalize_survey

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


@router.post("/rasterize-svg", response_model=SvgRasterizeResponse)
def rasterize_svg(req: SvgRasterizeRequest):
    try:
        svg_rasterization_service.validate_svg(req.svg)
        image = logo_gen_service.rasterize_svg(req.svg, size=1024)
    except svg_rasterization_service.InvalidSvg as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.warning("SVG rasterization rejected: %s", type(exc).__name__)
        raise HTTPException(status_code=400, detail="SVG could not be rasterized.") from exc

    if image.size != (1024, 1024):
        image = image.resize((1024, 1024))
    return SvgRasterizeResponse(imageBase64=_image_to_base64(image))


@router.post("/generate", response_model=GenerationResponse)
def generate_logo(req: GenerationRequest):
    raw_survey = req.to_survey_dict()
    normalized = _normalize_survey(raw_survey)
    style = normalized.get("style")
    brand_name = " ".join((normalized.get("brand_name") or "").split())
    if style in ("워드마크", "레터마크") and not brand_name:
        raise HTTPException(
            status_code=422,
            detail="워드마크와 레터마크를 생성하려면 브랜드명 또는 기업명이 필요합니다.",
        )
    try:
        # 워드마크/레터마크는 최종 결과에서 생성 심볼을 사용하지 않는다. 불필요한
        # 텍스트 변환·이미지 생성 호출을 건너뛰고 로컬 타이포그래피로 바로 만든다.
        if style in ("워드마크", "레터마크"):
            variant_index = req.variant_offset
            image = logo_composer.compose_final_logo(
                None, normalized, variant_index=variant_index
            )
            return GenerationResponse(
                modelName="local/pillow",
                logos=[
                    GeneratedLogo(
                        imageBase64=_image_to_base64(image),
                        seed=None,
                        variantIndex=variant_index,
                        svg=None,
                    )
                ],
            )

        survey = value_keyword_service.enrich_value_keywords(raw_survey)
        survey = motif_translation_service.enrich_logo_shape(survey)
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
            modelName=logo_gen_service.OPENROUTER_MODEL,
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
