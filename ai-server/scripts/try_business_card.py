"""business_card.py + business_card_showcase.py 함수를 실제로 호출해 명함
앞/뒷면/쇼케이스(카드 뭉치 연출샷)를 한 번에 만들어보는 테스트 스크립트.

[값 구분 원칙]
- 디자인 스타일 값(쇼케이스 배경색, 카드 크기·각도, 스택 효과 여부 등)은 특정
  누군가의 정보가 아니라 순수한 "보여주는 방식" 설정이라 고정 기본값으로 둔다.
- 명함 내용(브랜드명/태그라인/직함/이름/연락처, 로고)은 실행할 때마다 반드시
  달라져야 하는 값이라 전부 필수 인자(required=True)로 강제한다 — 기본값 없음.

사용법:
    cd ai-server
    python scripts/try_business_card.py \
      --logo path/to/logo.png \
      --brand-name "브랜드명" \
      --tagline "태그라인" \
      --title "직함" \
      --person-name "이름" \
      --mobile "전화번호" \
      --email "이메일" \
      --address "주소"
"""

import argparse
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.business_card import compose_card_front, compose_card_back, derive_card_bg_colors
from app.services.business_card_showcase import compose_card_showcase_v2

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "outputs" / "business_card"

FONT_BOLD = str(
    Path(__file__).resolve().parent.parent / "app" / "fonts" / "modern_sans" / "bold" / "Pretendard-Bold.ttf"
)
FONT_REGULAR = str(
    Path(__file__).resolve().parent.parent / "app" / "fonts" / "modern_sans" / "regular" / "Pretendard-Regular.ttf"
)

# ── 쇼케이스 "스타일" 고정값 ──────────────────────────────────────────
# 누구의 정보도 아닌, 순수 디자인 설정이라 여기서 고정해둔다. 명함 내용(아래
# argparse 필수 인자들)과는 성격이 다르다는 걸 명확히 하려고 파일 위쪽에
# 상수로 따로 뺐다 — 스타일만 바꾸고 싶으면 여기 값만 고치면 된다.
SHOWCASE_BG_COLOR = (150, 150, 150)
SHOWCASE_FRONT_WIDTH = 560
SHOWCASE_BACK_WIDTH = 420
SHOWCASE_FRONT_ANGLE = -13.0
SHOWCASE_BACK_ANGLE = 12.0
SHOWCASE_STACK_EFFECT = True


def main():
    parser = argparse.ArgumentParser(description="명함 앞/뒷면 + 쇼케이스 생성 테스트")
    parser.add_argument("--logo", required=True, help="로고 이미지 파일 경로")
    # 명함 내용 — 전부 필수. 실행할 때마다 반드시 달라지는 값이라 기본값 없음.
    parser.add_argument("--brand-name", required=True, help="브랜드명")
    parser.add_argument("--tagline", required=True, help="태그라인")
    parser.add_argument("--title", required=True, help="직함")
    parser.add_argument("--person-name", required=True, help="이름")
    parser.add_argument("--mobile", required=True, help="전화번호")
    parser.add_argument("--email", required=True, help="이메일")
    parser.add_argument("--address", required=True, help="주소")
    # 명함 배경색은 브랜드 팔레트에 따라 바뀔 수 있는 값이라 필수는 아니다.
    # 생략하면(None) 로고 색상에서 자동 유도한다(derive_card_bg_colors) — 로고와
    # 무관한 고정색을 쓰면 로고를 바꿔도 명함이 안 어울리는 문제가 있었다.
    parser.add_argument("--bg-front", default=None, help="R,G,B (앞면 배경색). 생략하면 로고 색에서 자동 유도")
    parser.add_argument("--bg-back", default=None, help="R,G,B (뒷면 배경색). 생략하면 로고 색에서 자동 유도")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    logo = Image.open(args.logo)

    derived_front, derived_back = derive_card_bg_colors(logo)
    bg_front = tuple(int(v) for v in args.bg_front.split(",")) if args.bg_front else derived_front
    bg_back = tuple(int(v) for v in args.bg_back.split(",")) if args.bg_back else derived_back

    front = compose_card_front(
        logo, args.brand_name, args.tagline,
        bg_color=bg_front,
        font_path_bold=FONT_BOLD, font_path_regular=FONT_REGULAR,
    )
    front_path = OUTPUT_DIR / "card_front.png"
    front.save(front_path)
    print(f"앞면 저장됨 -> {front_path}")

    back = compose_card_back(
        logo, args.brand_name, args.tagline,
        contact={
            "title": args.title, "person_name": args.person_name,
            "mobile": args.mobile, "email": args.email, "address": args.address,
        },
        bg_color=bg_back,
        font_path_bold=FONT_BOLD, font_path_regular=FONT_REGULAR,
    )
    back_path = OUTPUT_DIR / "card_back.png"
    back.save(back_path)
    print(f"뒷면 저장됨 -> {back_path}")

    # 쇼케이스는 내용(front/back)만 바뀌고, 스타일(SHOWCASE_* 고정값)은 항상 동일하게 적용.
    showcase = compose_card_showcase_v2(
        front, back,
        bg_color=SHOWCASE_BG_COLOR,
        front_width=SHOWCASE_FRONT_WIDTH,
        back_width=SHOWCASE_BACK_WIDTH,
        front_angle_deg=SHOWCASE_FRONT_ANGLE,
        back_angle_deg=SHOWCASE_BACK_ANGLE,
        stack_effect=SHOWCASE_STACK_EFFECT,
    )
    showcase_path = OUTPUT_DIR / "card_showcase.png"
    showcase.save(showcase_path)
    print(f"쇼케이스 저장됨 -> {showcase_path}")


if __name__ == "__main__":
    main()