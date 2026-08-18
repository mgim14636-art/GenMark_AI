"""브랜드킷(여러 제품이 한 장면에 함께 배치된 목업)에 로고를 합성하는 모듈."""

from dataclasses import dataclass, field
from typing import List, Tuple

from PIL import Image

from app.services.product_mockup import (
    LabelRegion,
    _fit_logo_with_padding,
    _warp_to_quad,
    _apply_product_lighting,
    _remove_flat_background,
)


@dataclass
class BrandKitTemplate:
    """여러 제품이 함께 배치된 브랜드킷 배경 하나."""
    name: str
    image_path: str
    regions: List[Tuple[str, LabelRegion]]
    padding_ratio: float = 0.12
    apply_lighting: bool = True


def compose_brand_kit(logo: Image.Image, template: BrandKitTemplate) -> Image.Image:
    """로고 하나를 템플릿의 모든 라벨 영역에 합성한 이미지 1장을 만든다."""
    scene = Image.open(template.image_path).convert("RGBA")
    transparent_logo = _remove_flat_background(logo)
    for _item_name, region in template.regions:
        fitted = _fit_logo_with_padding(transparent_logo, region, template.padding_ratio)
        warped, offset = _warp_to_quad(fitted, region)
        if template.apply_lighting:
            warped = _apply_product_lighting(warped, scene, offset)
        scene.paste(warped, offset, warped)
    return scene.convert("RGB")


def compose_brand_kits(logos: list, template: BrandKitTemplate) -> list:
    """로고 여러 시안 각각에 대해 같은 브랜드킷 템플릿을 적용한다."""
    return [compose_brand_kit(logo, template) for logo in logos]
