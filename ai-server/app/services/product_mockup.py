"""로고를 제품 목업(병/통/박스 등) 사진 위에 합성해 제품 썸네일을 만드는 모듈.

[선택 이유] AI(FLUX)한테 "로고가 박힌 화장품 사진"을 통째로 새로 그리게 하는
방식도 가능하지만, 그러면 로고 자체를 AI가 매번 다시 그리는 셈이라 우리가 만든
실제 로고와 미묘하게 다른 로고가 나온다 — 브랜드명 텍스트를 AI에게 안 맡기고
logo_composer.py가 후처리로 합성했던 것과 같은 이유로, 로고 전체도 후처리로
정확하게 박아 넣는 쪽을 선택했다.

미리 준비된 제품 목업 템플릿(배경 사진 + 라벨이 들어갈 영역 좌표)에, 이미 완성된
로고 이미지(logo_composer.compose_final_logo의 결과물)를 원근 변형해서 끼워 넣는다.
추가 AI 호출이 없어서 빠르고 비용이 안 들고, 로고가 픽셀 단위로 정확하게 유지된다.

라벨 영역은 사각형(bounding box)이 아니라 "4개 꼭짓점"으로 정의한다 — 병처럼 살짝
기울어진 표면도 자연스럽게 맞출 수 있게 하기 위함이다.
"""

from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


def _remove_flat_background(logo: Image.Image, threshold: int = 30) -> Image.Image:
    """로고 생성 모델이 남긴 단색 배경을 투명하게 지운다.

    — "스티커를 오려 붙인 것" 같은 이질감의 근본
    원인이 이거였다. 모서리 색을 배경으로 간주하고 floodfill로 배경과 연결된
    영역만 찾아서, 그 영역의 알파(투명도)만 0으로 낮춘다. 그러면 배경 자리엔
    제품 사진(병 표면) 자체가 그대로 비치고, 로고의 실제 도형·텍스트만
    "잉크로 인쇄된 것"처럼 남는다.
    """
    rgb = logo.convert("RGB")
    w, h = rgb.size
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    corner_colors = [rgb.getpixel(c) for c in corners]
    bg_rgb = tuple(round(sum(c[i] for c in corner_colors) / 4) for i in range(3))
    smoothed = rgb.filter(ImageFilter.GaussianBlur(radius=2))
    for corner in corners:
        ImageDraw.floodfill(smoothed, corner, bg_rgb, thresh=threshold)
    bg_flat = Image.new("RGB", (w, h), bg_rgb)
    diff = ImageChops.difference(smoothed, bg_flat).convert("L")
    alpha = diff.point(lambda p: 0 if p == 0 else 255)
    result = logo.convert("RGBA")
    result.putalpha(alpha)
    return result


@dataclass
class LabelRegion:
    """제품 목업 이미지 안에서 로고가 들어갈 라벨 영역.

    4개 꼭짓점을 (좌상, 우상, 우하, 좌하) 순서로 지정한다.
    """
    top_left: tuple
    top_right: tuple
    bottom_right: tuple
    bottom_left: tuple

    def bbox(self) -> tuple:
        xs = [self.top_left[0], self.top_right[0], self.bottom_right[0], self.bottom_left[0]]
        ys = [self.top_left[1], self.top_right[1], self.bottom_right[1], self.bottom_left[1]]
        return min(xs), min(ys), max(xs), max(ys)


@dataclass
class ProductTemplate:
    """제품 목업 하나(병, 통, 박스)."""
    name: str
    image_path: str
    label_region: LabelRegion
    padding_ratio: float = 0.12
    apply_lighting: bool = True


def _fit_logo_with_padding(logo: Image.Image, region: LabelRegion, padding_ratio: float) -> Image.Image:
    """로고를 라벨 영역 바운딩박스 크기에 맞추고, 지정한 비율만큼 여백을 둔 채
    투명 배경 위에 중앙 정렬한다.
    """
    left, top, right, bottom = region.bbox()
    target_w = max(int(round(right - left)), 1)
    target_h = max(int(round(bottom - top)), 1)
    logo_rgba = logo.convert("RGBA")
    logo_ratio = logo_rgba.width / logo_rgba.height
    pad_w = round(target_w * padding_ratio)
    pad_h = round(target_h * padding_ratio)
    inner_w = max(target_w - pad_w * 2, 1)
    inner_h = max(target_h - pad_h * 2, 1)
    if logo_ratio > (inner_w / inner_h):
        new_w = inner_w
        new_h = max(round(inner_w / logo_ratio), 1)
    else:
        new_h = inner_h
        new_w = max(round(inner_h * logo_ratio), 1)
    resized = logo_rgba.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    paste_x = (target_w - resized.width) // 2
    paste_y = (target_h - resized.height) // 2
    canvas.paste(resized, (paste_x, paste_y), resized)
    return canvas


def _warp_to_quad(source: Image.Image, region: LabelRegion) -> tuple:
    """직사각형 이미지를 라벨 영역의 4개 꼭짓점 모양으로 원근 변형한다."""
    left, top, right, bottom = region.bbox()
    dest_w = max(int(round(right - left)), 1)
    dest_h = max(int(round(bottom - top)), 1)

    def local(pt):
        return pt[0] - left, pt[1] - top

    quad_coeffs = [
        *local(region.top_left), *local(region.bottom_left),
        *local(region.bottom_right), *local(region.top_right),
    ]
    warped = source.transform((dest_w, dest_h), Image.QUAD, quad_coeffs, resample=Image.BICUBIC)
    return warped, (int(round(left)), int(round(top)))


def _apply_product_lighting(logo_layer: Image.Image, mockup: Image.Image, offset: tuple) -> Image.Image:
    """로고를 실제 인쇄된 라벨처럼 병 표면에 녹아들게 만든다.

    단순히 로고를 얹은 사진처럼 보이지 않게 하려고 세 가지를 함께 적용한다.
    1) 명암 곱연산을 이전보다 강하게 걸어 병의 하이라이트/그림자가 로고에도
       그대로 드러나게 한다(원본 색을 살짝만 남겨 잉크 채도는 유지).
    2) 라벨 좌우 끝을 알파로 감쇠시켜, 원통형 표면을 감싸고 돌아가다 시야에서
       사라지는 실제 라벨처럼 보이게 한다 — 이게 없으면 사각 스티커를 붙인
       것처럼 보이는 원인이 된다.
    3) 가장자리를 살짝 블러 처리해 인쇄면과 유리 표면의 경계를 부드럽게 한다.
    """
    x, y = offset
    w, h = logo_layer.size
    region_crop = mockup.convert("RGB").crop((x, y, x + w, y + h))
    lighting = region_crop.convert("L").convert("RGB")
    lighting = ImageEnhance.Contrast(lighting).enhance(0.75)
    lighting = ImageEnhance.Brightness(lighting).enhance(1.05)
    logo_arr = np.asarray(logo_layer.convert("RGB")).astype("float32") / 255.0
    light_arr = np.asarray(lighting).astype("float32") / 255.0
    multiplied = logo_arr * light_arr
    blended = multiplied * 0.82 + logo_arr * 0.18
    blended_arr = (blended * 255.0).clip(0, 255).astype("uint8")
    blended_rgb = Image.fromarray(blended_arr, mode="RGB")

    alpha = np.asarray(logo_layer.split()[-1]).astype("float32")
    curve_x = np.linspace(-1.0, 1.0, w)
    curvature = np.cos(curve_x * (np.pi / 2) * 0.9)
    curvature = np.clip(curvature, 0.3, 1.0)
    curvature = np.tile(curvature, (h, 1))
    alpha = alpha * curvature * 0.94

    result = blended_rgb.convert("RGBA")
    result.putalpha(Image.fromarray(alpha.clip(0, 255).astype("uint8"), mode="L"))
    result = result.filter(ImageFilter.GaussianBlur(radius=0.7))
    return result


def compose_product_thumbnail(logo: Image.Image, template: ProductTemplate) -> Image.Image:
    """완성된 로고를 제품 목업 템플릿에 합성해 제품 썸네일 1장을 만든다."""
    mockup = Image.open(template.image_path).convert("RGBA")
    transparent_logo = _remove_flat_background(logo)
    fitted_logo = _fit_logo_with_padding(transparent_logo, template.label_region, template.padding_ratio)
    warped_logo, offset = _warp_to_quad(fitted_logo, template.label_region)
    if template.apply_lighting:
        warped_logo = _apply_product_lighting(warped_logo, mockup, offset)
    result = mockup.copy()
    result.paste(warped_logo, offset, warped_logo)
    return result.convert("RGB")


def compose_product_thumbnails(logos: list, template: ProductTemplate) -> list:
    """여러 로고 시안에 같은 템플릿을 일괄 적용한다."""
    return [compose_product_thumbnail(logo, template) for logo in logos]
