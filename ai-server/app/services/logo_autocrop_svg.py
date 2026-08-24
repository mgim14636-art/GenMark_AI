# -*- coding: utf-8 -*-
"""
logo_autocrop_svg.py
======================
PNG용 autocrop(logo_autocrop.py)의 SVG 버전.

SVG는 픽셀이 아니라 벡터 좌표로 그려지기 때문에, PNG처럼 "투명하지 않은
픽셀 찾기"가 아니라 "실제로 그려지는 도형들의 좌표 범위(bounding box)"를
계산해서 viewBox를 그 범위에 딱 맞게 다시 잡아주는 방식으로 접근한다.

Recraft가 SVG를 생성할 때도 PNG와 마찬가지로 viewBox 캔버스 안에서
실제 그림이 차지하는 비율이 매번 달라질 수 있음 (그림이 캔버스 중앙에
꽉 차게 나올 때도, 한쪽에 작게 치우쳐 나올 때도 있음) -> 그대로 두면
PNG 때와 똑같은 "위치가 매번 달라 보이는" 문제가 재현됨.

방법: cairosvg로 일단 고해상도 PNG로 래스터화한 뒤, PNG 기준으로
실제 그림의 bounding box(픽셀 좌표)를 찾고, 그 비율을 다시 SVG
좌표계로 환산해서 viewBox만 교체한 새 SVG를 만든다.
(SVG 자체를 파싱해서 path별 좌표를 계산하는 것보다 훨씬 간단하고,
곡선/그룹/변형(transform)이 섞여 있어도 안정적으로 동작함)
"""

import io
import re
import cairosvg
from PIL import Image
import numpy as np


def _get_svg_size(svg_text: str, render_size: int = 1000):
    """viewBox 또는 width/height에서 원본 SVG 좌표계 크기를 파싱."""
    vb_match = re.search(r'viewBox="([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)"', svg_text)
    if vb_match:
        min_x, min_y, w, h = map(float, vb_match.groups())
        return min_x, min_y, w, h
    # viewBox가 없으면 width/height 속성으로 대체
    w_match = re.search(r'width="([\d.]+)', svg_text)
    h_match = re.search(r'height="([\d.]+)', svg_text)
    w = float(w_match.group(1)) if w_match else render_size
    h = float(h_match.group(1)) if h_match else render_size
    return 0.0, 0.0, w, h


def autocrop_svg_to_content(svg_path: str, output_path: str,
                             alpha_threshold: int = 10,
                             uniform_padding_ratio: float = 0.04,
                             render_size: int = 1000) -> str:
    """
    SVG 파일의 viewBox를, 실제로 그려지는 도형의 bounding box에 맞게
    다시 계산해서 새 SVG로 저장. (PNG 변환 없이 SVG 그대로 유지됨 -> 벡터 장점 보존)
    """
    with open(svg_path, "r", encoding="utf-8") as f:
        svg_text = f.read()

    orig_min_x, orig_min_y, orig_w, orig_h = _get_svg_size(svg_text)

    # 1) 고해상도로 임시 래스터화 -> 픽셀 기준 bounding box 계산용
    png_bytes = cairosvg.svg2png(
        bytestring=svg_text.encode("utf-8"),
        output_width=render_size,
        output_height=int(render_size * orig_h / orig_w),
    )
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    arr = np.array(img)
    alpha = arr[:, :, 3]
    mask = alpha > alpha_threshold
    if not mask.any():
        raise ValueError(f"'{svg_path}' 렌더링 결과에 불투명 픽셀이 없음 (빈 SVG)")

    ys, xs = np.where(mask)
    px_x0, px_x1 = xs.min(), xs.max() + 1
    px_y0, px_y1 = ys.min(), ys.max() + 1
    render_w, render_h = img.size

    # 2) 픽셀 bounding box 비율을 원본 SVG 좌표계로 환산
    ratio_x0 = px_x0 / render_w
    ratio_x1 = px_x1 / render_w
    ratio_y0 = px_y0 / render_h
    ratio_y1 = px_y1 / render_h

    new_min_x = orig_min_x + ratio_x0 * orig_w
    new_max_x = orig_min_x + ratio_x1 * orig_w
    new_min_y = orig_min_y + ratio_y0 * orig_h
    new_max_y = orig_min_y + ratio_y1 * orig_h

    content_w = new_max_x - new_min_x
    content_h = new_max_y - new_min_y

    # 3) 균일 여백 추가 (원본 여백 크기와 무관하게 항상 같은 비율로 통일)
    pad_x = content_w * uniform_padding_ratio
    pad_y = content_h * uniform_padding_ratio
    final_min_x = new_min_x - pad_x
    final_min_y = new_min_y - pad_y
    final_w = content_w + pad_x * 2
    final_h = content_h + pad_y * 2

    # 4) viewBox만 교체 (도형 좌표 자체는 안 건드림 -> 벡터 원본 유지)
    new_viewbox = f'viewBox="{final_min_x:.3f} {final_min_y:.3f} {final_w:.3f} {final_h:.3f}"'
    if re.search(r'viewBox="[^"]*"', svg_text):
        new_svg = re.sub(r'viewBox="[^"]*"', new_viewbox, svg_text, count=1)
    else:
        new_svg = svg_text.replace("<svg", f"<svg {new_viewbox}", 1)

    # width/height 고정 속성이 있으면 제거 (viewBox 비율을 그대로 따르도록)
    new_svg = re.sub(r'\s+width="[\d.]+(px)?"', '', new_svg, count=1)
    new_svg = re.sub(r'\s+height="[\d.]+(px)?"', '', new_svg, count=1)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(new_svg)

    return output_path


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("사용법: python logo_autocrop_svg.py 입력경로.svg 출력경로.svg")
        sys.exit(1)
    result = autocrop_svg_to_content(sys.argv[1], sys.argv[2])
    print("저장됨:", result)