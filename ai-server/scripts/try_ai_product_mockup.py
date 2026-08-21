"""설문 -> 로고 생성 파이프라인 -> AI 이미지 편집으로 목업 사진에 합성까지 한 번에 처리.

product_mockup_ai_service는 PIL 원근 합성(product_mockup.py) 대신 AI 이미지 편집
모델(FLUX.2 Pro)로 로고를 목업 사진 라벨에 앉힌다. 기본으로 3개 목업
(top_left/top_right/bottom_left) 전부를 생성한다.

사용법:
    python scripts/try_ai_product_mockup.py \
      --brand-name "글로우랩" --industry 뷰티 --tone "전문적이고 신뢰감 있는" \
      --color-manual "#40AA85,#FFFFFF"
"""

import argparse
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.logo_gen_service import generate_logo_from_survey
from app.services.logo_composer import compose_final_logo
from app.services.product_mockup_ai_service import (
    MOCKUP_TEMPLATES,
    composite_logo_onto_mockup,
)

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "outputs" / "ai_product_mockup"


def _generate_logo(args) -> Image.Image:
    survey = {
        "brand_name": args.brand_name,
        "style": args.style,
        "industry": args.industry,
        "tone": args.tone,
    }
    if args.color_manual:
        survey["color_mode"] = "manual"
        survey["color_manual"] = args.color_manual.split(",")
    symbols = generate_logo_from_survey(survey, num_variants=1)
    if not symbols:
        raise RuntimeError("로고 생성에 실패했습니다.")
    return compose_final_logo(symbols[0], survey)


def main():
    parser = argparse.ArgumentParser(description="AI 편집으로 로고를 화장품 목업에 합성")
    parser.add_argument("--logo", help="이미 만들어둔 로고 파일 경로")
    parser.add_argument("--brand-name", help="브랜드명 (로고 신규 생성 시 필요)")
    parser.add_argument("--style", default="심볼")
    parser.add_argument("--industry", default="뷰티")
    parser.add_argument("--tone", default="전문적이고 신뢰감 있는")
    parser.add_argument("--color-manual", help="쉼표로 구분된 hex, 예: '#1B2A4E,#FFFFFF'")
    parser.add_argument(
        "--template",
        choices=[*MOCKUP_TEMPLATES.keys(), "all"],
        default="all",
        help="합성할 목업 (기본: all - 3장 전부)",
    )
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.logo:
        logo = Image.open(args.logo)
        print(f"기존 로고 파일 사용 -> {args.logo}")
    else:
        if not args.brand_name:
            raise SystemExit("--logo가 없으면 --brand-name은 필수입니다.")
        print("설문으로 로고를 새로 생성하는 중...")
        logo = _generate_logo(args)
        logo_path = OUTPUT_DIR / "generated_logo.png"
        logo.save(logo_path)
        print(f"로고 생성 완료 -> {logo_path}")

    templates = list(MOCKUP_TEMPLATES.keys()) if args.template == "all" else [args.template]
    for name in templates:
        print(f"AI 편집 합성 중... ({name})")
        result = composite_logo_onto_mockup(logo, template=name, brand_name=args.brand_name or "")
        out_path = OUTPUT_DIR / f"mockup_{name}.png"
        result.save(out_path)
        print(f"저장됨 -> {out_path}")


if __name__ == "__main__":
    main()
