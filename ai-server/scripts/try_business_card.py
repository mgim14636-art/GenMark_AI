"""business_card.py + business_card_showcase.py 함수를 실제로 호출해 명함
앞/뒷면/쇼케이스(기울여 겹친 연출샷)를 한 번에 만들어보는 테스트 스크립트.

scripts/try_logo.py, scripts/try_models.py와 같은 원칙 — app/services/*.py는
건드리지 않고, 그 함수들을 가져다 실제로 돌려서 결과만 확인한다.

실행할 때마다 앞면/뒷면/쇼케이스 3장이 항상 같이 만들어진다(자동, 별도 옵션 불필요).

사용법:
    cd ai-server
    python scripts/try_business_card.py --logo path/to/logo.png
"""

import argparse
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.business_card import compose_card_front, compose_card_back
from app.services.business_card_showcase import compose_card_showcase

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "outputs" / "business_card"

FONT_BOLD = str(
    Path(__file__).resolve().parent.parent / "app" / "fonts" / "modern_sans" / "bold" / "Pretendard-Bold.ttf"
)
FONT_REGULAR = str(
    Path(__file__).resolve().parent.parent / "app" / "fonts" / "modern_sans" / "regular" / "Pretendard-Regular.ttf"
)


def main():
    parser = argparse.ArgumentParser(description="명함 앞/뒷면 + 쇼케이스 생성 테스트")
    parser.add_argument("--logo", required=True, help="로고 이미지 파일 경로")
    parser.add_argument("--brand-name", default="글로우랩")
    parser.add_argument("--tagline", default="since 2024")
    parser.add_argument("--title", default="대표")
    parser.add_argument("--person-name", default="김철수")
    parser.add_argument("--mobile", default="010-9999-8888")
    parser.add_argument("--email", default="hello@glowlab.com")
    parser.add_argument("--address", default="서울시 강남구 어딘가 123")
    parser.add_argument("--bg-front", default="20,40,32", help="R,G,B (앞면 배경색)")
    parser.add_argument("--bg-back", default="230,245,240", help="R,G,B (뒷면 배경색)")
    parser.add_argument(
        "--showcase-bg-left", default=None,
        help="R,G,B (쇼케이스 배경 왼쪽 톤). 생략하면 --bg-front에서 자동 유도",
    )
    parser.add_argument(
        "--showcase-bg-right", default=None,
        help="R,G,B (쇼케이스 배경 오른쪽 톤). 생략하면 --bg-back에서 자동 유도",
    )
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    logo = Image.open(args.logo)

    bg_front = tuple(int(v) for v in args.bg_front.split(","))
    bg_back = tuple(int(v) for v in args.bg_back.split(","))
    showcase_bg_left = (
        tuple(int(v) for v in args.showcase_bg_left.split(","))
        if args.showcase_bg_left else None
    )
    showcase_bg_right = (
        tuple(int(v) for v in args.showcase_bg_right.split(","))
        if args.showcase_bg_right else None
    )

    front = compose_card_front(
        logo,
        args.brand_name,
        args.tagline,
        bg_color=bg_front,
        font_path_bold=FONT_BOLD,
        font_path_regular=FONT_REGULAR,
    )
    front_path = OUTPUT_DIR / "card_front.png"
    front.save(front_path)
    print(f"앞면 저장됨 -> {front_path}")

    back = compose_card_back(
        logo,
        args.brand_name,
        args.tagline,
        contact={
            "title": args.title,
            "person_name": args.person_name,
            "mobile": args.mobile,
            "email": args.email,
            "address": args.address,
        },
        bg_color=bg_back,
        font_path_bold=FONT_BOLD,
        font_path_regular=FONT_REGULAR,
    )
    back_path = OUTPUT_DIR / "card_back.png"
    back.save(back_path)
    print(f"뒷면 저장됨 -> {back_path}")

    showcase = compose_card_showcase(
        front, back,
        bg_color_left=showcase_bg_left,
        bg_color_right=showcase_bg_right,
    )
    showcase_path = OUTPUT_DIR / "card_showcase.png"
    showcase.save(showcase_path)
    print(f"쇼케이스 저장됨 -> {showcase_path}")


if __name__ == "__main__":
    main()