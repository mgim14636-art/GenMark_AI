"""제품 썸네일(브랜드킷 PRODUCT_THUMBNAIL) 합성 결과를 눈으로 확인한다.

썸네일은 AI 생성이 아니라 PIL 합성이다 — 제품 누끼컷 업로드가 아직 없어서
로고만으로 만들 수 있는 범위(배경 + 로고 + 제품명 + 헤드라인)로 한정돼 있다.
그래서 API 비용 없이 얼마든지 돌려볼 수 있다.

배경 스타일 3종을 한 장에 나란히 붙여 비교 시트도 만든다.

사용법:
    cd ai-server
    python scripts/try_thumbnail.py --logo data/outputs/logo_try_Tree_combination_minimal_1.png
    python scripts/try_thumbnail.py --logo <경로> --product-name "비건 세럼" --headline "저자극 데일리 케어"
    python scripts/try_thumbnail.py --logo <경로> --color "#0f5f66" --category SERUM
    python scripts/try_thumbnail.py --logo <경로> --style SOLID_LIGHT      # 한 종류만

컨테이너에서 돌리려면(로컬에 fastapi가 없을 때):
    docker compose -f docker-compose.local.yml exec ai-server \
        python scripts/try_thumbnail.py --logo data/outputs/<파일>.png
"""
import argparse
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.services.brand_kit_service import _compose_product_thumbnail  # noqa: E402

OUT_DIR = ROOT / "data" / "outputs" / "thumbnail"
STYLES = ("TONE_GRADIENT", "SOLID_LIGHT", "SOFT_SHADOW")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--logo", required=True, help="합성할 로고 이미지 경로")
    ap.add_argument("--product-name", default="", help="비우면 설문의 브랜드명을 쓴다")
    ap.add_argument("--brand", default="Beyond", help="product-name이 비었을 때 쓰는 브랜드명")
    ap.add_argument("--headline", default="", help="제품명 아래 한 줄 문구")
    ap.add_argument("--category", default=None, help="상단 카테고리 라벨 키")
    ap.add_argument("--color", default="#0f5f66", help="강조색 HEX (배경 그라데이션·라벨색)")
    ap.add_argument("--style", default=None, choices=STYLES, help="지정하면 그 배경만 만든다")
    args = ap.parse_args()

    logo_path = Path(args.logo)
    if not logo_path.exists():
        print(f"로고 파일이 없습니다: {logo_path}")
        return 1

    logo = Image.open(logo_path)
    survey = {"company_name": args.brand, "color_manual": [args.color]}
    styles = [args.style] if args.style else list(STYLES)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    made = []
    for style in styles:
        img, ratio = _compose_product_thumbnail(
            logo,
            args.product_name or None,
            survey,
            category=args.category,
            background_style=style,
            headline=args.headline or None,
        )
        out = OUT_DIR / f"thumb_{style}.png"
        img.save(out)
        made.append((style, out, img, ratio))
        # 텍스트 면적 비율은 판매 채널 심사 기준 대응용 지표다.
        print(f"  {style:<14} {out}  텍스트 면적 {ratio * 100:.1f}%")

    if len(made) > 1:
        gap = 24
        w = sum(m[2].width for m in made) + gap * (len(made) - 1)
        h = max(m[2].height for m in made)
        sheet = Image.new("RGB", (w, h), (228, 228, 228))
        x = 0
        for _, _, img, _ in made:
            sheet.paste(img, (x, 0))
            x += img.width + gap
        sheet_path = OUT_DIR / "thumb_compare.png"
        sheet.resize((w // 2, h // 2)).save(sheet_path)
        print(f"\n비교 시트: {sheet_path}")

    print(f"\n폴더 열기: explorer {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
