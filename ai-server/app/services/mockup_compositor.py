# -*- coding: utf-8 -*-
"""
mockup_compositor.py
======================
로고를 목업 라벨 위치에 합성하는 최종 모듈.

구조:
- 좌표를 코드(.py) 안에 직접 쓰지 않음.
- label_zones.json 파일에서 "목업파일명 -> 부위명 -> quad좌표"를 읽어와서 동작.
- 새 목업이 추가되면 코드 수정 없이 label_zones.json에 항목만 추가하면 됨.

이번 버전에서 추가된 것:
- zone 하나가 실패해도 조용히 스킵되지 않고, 어떤 zone이 왜 실패했는지
  터미널에 명확히 출력함 (이전에 앰플병 로고가 이유 없이 빠지는 문제가
  있었는데, 원인을 눈으로 바로 볼 수 있게 하기 위함)
- 처리 시작/완료를 zone별로 print해서 진행 상황을 추적 가능하게 함
"""

import json
import os
import cv2
import numpy as np


def load_zones(json_path: str) -> dict:
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def calibrate_grid(image_path: str, crop_box: tuple, scale: int = 4,
                    grid_step: int = 20, out_path: str = "calibration_grid.png") -> str:
    """새 목업 사진의 라벨 좌표를 눈으로 잴 때 쓰는 그리드 오버레이 생성기."""
    from PIL import Image, ImageDraw
    im = Image.open(image_path).convert("RGB")
    crop = im.crop(crop_box).resize(
        ((crop_box[2] - crop_box[0]) * scale, (crop_box[3] - crop_box[1]) * scale)
    )
    draw = ImageDraw.Draw(crop)
    for x in range(0, crop.width, grid_step * scale):
        draw.line([(x, 0), (x, crop.height)], fill=(255, 0, 0), width=1)
        draw.text((x + 2, 2), str(x // scale + crop_box[0]), fill=(255, 0, 0))
    for y in range(0, crop.height, grid_step * scale):
        draw.line([(0, y), (crop.width, y)], fill=(0, 255, 0), width=1)
        draw.text((2, y + 2), str(y // scale + crop_box[1]), fill=(0, 255, 0))
    crop.save(out_path)
    return out_path


def composite_logo(mockup_path: str, logo_path: str, quad: list,
                    output_path: str, shading_strength: float = 0.45,
                    feather: int = 3, max_width_ratio: float = 0.85) -> np.ndarray:
    """
    quad: [[x,y],[x,y],[x,y],[x,y]] 좌상->우상->우하->좌하 순서.
    (이 함수 자체는 좌표를 모름 -- 호출하는 쪽에서 JSON을 읽어 넘겨줌)
    """
    mockup = cv2.imread(mockup_path, cv2.IMREAD_COLOR)
    if mockup is None:
        raise FileNotFoundError(f"목업 이미지를 못 읽었음: {mockup_path}")

    logo = cv2.imread(logo_path, cv2.IMREAD_UNCHANGED)
    if logo is None:
        raise FileNotFoundError(f"로고 이미지를 못 읽었음: {logo_path}")

    if logo.ndim == 2:  # 흑백 로고 방지
        logo = cv2.cvtColor(logo, cv2.COLOR_GRAY2BGR)
    if logo.shape[2] == 3:
        alpha = np.full(logo.shape[:2], 255, dtype=np.uint8)
        logo = np.dstack([logo, alpha])

    h_logo, w_logo = logo.shape[:2]
    H, W = mockup.shape[:2]
    dst_pts = np.float32(quad)

    # 로고 비율을 유지하면서 quad 안에 여백을 두고 중앙 배치
    qx = dst_pts[:, 0]; qy = dst_pts[:, 1]
    quad_w = qx.max() - qx.min()
    quad_h = qy.max() - qy.min()
    logo_ratio = w_logo / h_logo
    target_w = quad_w * max_width_ratio
    target_h = target_w / logo_ratio
    if target_h > quad_h * 0.9:
        target_h = quad_h * 0.9
        target_w = target_h * logo_ratio
    cx, cy = qx.mean(), qy.mean()
    inner = np.float32([
        [cx - target_w / 2, cy - target_h / 2],
        [cx + target_w / 2, cy - target_h / 2],
        [cx + target_w / 2, cy + target_h / 2],
        [cx - target_w / 2, cy + target_h / 2],
    ])

    src_pts = np.float32([[0, 0], [w_logo, 0], [w_logo, h_logo], [0, h_logo]])
    M = cv2.getPerspectiveTransform(src_pts, inner)

    logo_bgr, logo_alpha = logo[:, :, :3], logo[:, :, 3]
    warped_bgr = cv2.warpPerspective(logo_bgr, M, (W, H), flags=cv2.INTER_CUBIC,
                                      borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
    warped_alpha = cv2.warpPerspective(logo_alpha, M, (W, H), flags=cv2.INTER_CUBIC,
                                        borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    if feather > 0:
        k = feather * 2 + 1
        warped_alpha = cv2.GaussianBlur(warped_alpha, (k, k), 0)

    if shading_strength > 0:
        gray = cv2.GaussianBlur(cv2.cvtColor(mockup, cv2.COLOR_BGR2GRAY), (0, 0), sigmaX=6).astype(np.float64)
        quad_mask = np.zeros((H, W), dtype=np.uint8)
        cv2.fillPoly(quad_mask, [np.int32(inner)], 255)
        region_mean = cv2.mean(gray, mask=quad_mask)[0]
        shading = np.clip(gray / max(region_mean, 1e-6), 0.55, 1.55)
        mix = (1 - shading_strength) + shading_strength * shading
        for c in range(3):
            warped_bgr[:, :, c] = np.clip(warped_bgr[:, :, c].astype(np.float64) * mix, 0, 255).astype(np.uint8)

    # 실제로 로고가 그려진 픽셀이 있는지 검증 (알파 최대값이 0이면 안 그려진 것)
    if warped_alpha.max() == 0:
        raise RuntimeError(
            f"경고: 이 quad({quad}) 위치에 로고가 전혀 그려지지 않았음. "
            f"좌표가 이미지 범위({W}x{H}) 밖이거나 quad 크기가 0일 가능성이 있음."
        )

    alpha_f = (warped_alpha.astype(np.float64) / 255.0)[:, :, None]
    result = mockup.astype(np.float64) * (1 - alpha_f) + warped_bgr.astype(np.float64) * alpha_f
    result = np.clip(result, 0, 255).astype(np.uint8)
    cv2.imwrite(output_path, result)
    return result


def composite_from_config(mockup_dir: str, zones_json: str, mockup_filename: str,
                           zone_name: str, logo_path: str, output_path: str):
    """실제로 쓰게 될 진입점: 목업 파일명 + 부위명만 넘기면 JSON에서 좌표를 찾아 합성."""
    zones = load_zones(zones_json)
    zone_cfg = zones[mockup_filename][zone_name]
    return composite_logo(
        mockup_path=os.path.join(mockup_dir, mockup_filename),
        logo_path=logo_path,
        quad=zone_cfg["quad"],
        output_path=output_path,
        shading_strength=zone_cfg.get("shading_strength", 0.45),
        max_width_ratio=zone_cfg.get("max_width_ratio", 0.85),
    )


if __name__ == "__main__":
    # ===== 아래 4개 경로만 본인 프로젝트 구조에 맞게 수정하세요 =====
    MOCKUP_DIR = "./mockups"                     # 목업 원본 사진(top_left.png 등)이 있는 폴더
    ZONES_JSON = "./label_zones.json"             # 이 파일과 같은 위치에 두면 됨
    LOGO_PATH = "./generated_logo.png"            # Recraft가 생성한 로고 (PNG, 알파 채널 권장)
    OUTPUT_DIR = "./outputs"                      # 결과 저장 폴더
    # ================================================================

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    mockup_file = "top_left.png"  # 지금은 이 목업 하나만 사용
    zones = load_zones(ZONES_JSON)

    if mockup_file not in zones:
        raise KeyError(f"label_zones.json에 '{mockup_file}' 항목이 없음. JSON 확인 필요.")

    stage_path = os.path.join(MOCKUP_DIR, mockup_file)
    final_path = os.path.join(OUTPUT_DIR, mockup_file.replace(".png", "_composited.png"))

    tmp_path = os.path.join(OUTPUT_DIR, "_stage_tmp.png")
    cv2.imwrite(tmp_path, cv2.imread(stage_path))

    zone_list = ["spray_bottle", "dropper_bottle", "cream_jar"]
    print(f"[시작] {mockup_file} - 처리할 zone: {zone_list}")

    results = {}
    for zone_name in zone_list:
        if zone_name not in zones[mockup_file]:
            print(f"  [건너뜀] '{zone_name}' 이 label_zones.json에 없음")
            results[zone_name] = "missing_in_json"
            continue

        zone_cfg = zones[mockup_file][zone_name]
        try:
            composite_logo(
                mockup_path=tmp_path,
                logo_path=LOGO_PATH,
                quad=zone_cfg["quad"],
                output_path=tmp_path,
                shading_strength=zone_cfg.get("shading_strength", 0.45),
                max_width_ratio=zone_cfg.get("max_width_ratio", 0.85),
            )
            print(f"  [완료] '{zone_name}' 합성 성공 (quad={zone_cfg['quad']})")
            results[zone_name] = "ok"
        except Exception as e:
            print(f"  [실패] '{zone_name}' 합성 실패: {e}")
            results[zone_name] = f"error: {e}"

    os.replace(tmp_path, final_path)
    print(f"[종료] 결과 저장: {final_path}")
    print(f"[요약] {results}")

    failed = [k for k, v in results.items() if v != "ok"]
    if failed:
        print(f"\n!! 주의: 다음 zone은 로고가 안 들어갔습니다 -> {failed}")
        print("   위 [실패]/[건너뜀] 로그에서 원인을 확인하세요.")