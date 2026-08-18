"""설문 -> 로고 생성 파이프라인 -> 화장품 세트 템플릿 합성까지 한 번에 처리.

사용법:
    python scripts/try_cosmetic_thumbnail.py \
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
from app.services.brand_kit import compose_brand_kit
from app.services.cosmetic_gift_set_template import COSMETIC_GIFT_SET_TEMPLATE

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "outputs" / "product_thumbnail"


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
    parser = argparse.ArgumentParser(description="화장품 세트 제품 썸네일 생성")
    parser.add_argument("--logo", help="이미 만들어둔 로고 파일 경로")
    parser.add_argument("--brand-name", help="브랜드명 (로고 신규 생성 시 필요)")
    parser.add_argument("--style", default="심볼")
    parser.add_argument("--industry", default="뷰티")
    parser.add_argument("--tone", default="전문적이고 신뢰감 있는")
    parser.add_argument("--color-manual", help="쉼표로 구분된 hex, 예: '#1B2A4E,#FFFFFF'")
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

    result = compose_brand_kit(logo, COSMETIC_GIFT_SET_TEMPLATE)
    out_path = OUTPUT_DIR / "cosmetic_gift_set_thumbnail.png"
    result.save(out_path)
    print(f"제품 썸네일 저장됨 -> {out_path}")


if __name__ == "__main__":
    main()
