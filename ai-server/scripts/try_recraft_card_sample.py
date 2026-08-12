"""business_card_sample_service.py의 프롬프트 조립 로직을 실제로 호출해
명함 디자인 샘플(앞/뒷면)을 만들어보는 실험용 CLI 스크립트.

scripts/try_logo.py, scripts/try_business_card.py와 같은 원칙 — app/services/*.py는
건드리지 않고, 그 함수들을 가져다 실제로 돌려서 결과만 확인한다.

[중요] 프롬프트 조립(_rgb_to_hex, build_front_prompt, build_back_prompt)은
business_card_sample_service.py의 것을 그대로 import해서 쓴다 — 이 스크립트에서
따로 복제하면 CLI로 확인한 프롬프트와 실제 API가 받는 프롬프트가 어긋날 수 있다.

이 스크립트는 텍스트까지 AI(Recraft)가 직접 그리는 "디자인 참고용 샘플"이다.
실제 배포용 최종 명함은 반드시 scripts/try_business_card.py(코드 렌더링,
텍스트 100% 정확)로 만들어야 한다.

사용법:
    cd ai-server
    python scripts/try_recraft_card_sample.py
    python scripts/try_recraft_card_sample.py --brand-name "글로우랩" --tagline "since 2024"
    python scripts/try_recraft_card_sample.py --dry   # 호출 없이 프롬프트만 출력(무료)
"""

import argparse
import sys
from pathlib import Path

# ai-server 루트를 import 경로에 올린다 (app 패키지를 찾기 위해)
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.services.business_card_sample_service import (  # noqa: E402
    _composite_on_bg,
    build_back_prompt,
    build_front_prompt,
)
from app.services.logo_gen_service import _call_image_api  # noqa: E402

OUTPUT_DIR = ROOT / "outputs" / "business_card_sample"


def parse_args():
    parser = argparse.ArgumentParser(description="Recraft 명함 디자인 샘플 CLI 테스트")
    parser.add_argument("--brand-name", default="글로우랩")
    parser.add_argument("--tagline", default="since 2024")
    parser.add_argument("--title", default="대표")
    parser.add_argument("--person-name", default="김철수")
    parser.add_argument("--mobile", default="010-9999-8888")
    parser.add_argument("--email", default="hello@glowlab.com")
    parser.add_argument("--address", default="서울시 강남구 어딘가 123")
    parser.add_argument("--bg-front", default="27,42,78", help="R,G,B (앞면 배경색)")
    parser.add_argument("--bg-back", default="250,235,241", help="R,G,B (뒷면 배경색)")
    parser.add_argument("--dry", action="store_true", help="API 호출 없이 프롬프트만 출력")
    return parser.parse_args()


def main():
    args = parse_args()

    front_prompt = build_front_prompt(args.brand_name, args.tagline, args.bg_front)
    back_prompt = build_back_prompt(
        args.brand_name, args.title, args.person_name, args.mobile,
        args.email, args.address, args.bg_back,
    )

    print("=== front prompt ===")
    print(front_prompt)
    print()
    print("=== back prompt ===")
    print(back_prompt)
    print()

    if args.dry:
        print("(--dry: API 호출 생략)")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Calling Recraft for front side ...")
    front_img, _ = _call_image_api(front_prompt, seed=1001)
    front_img = _composite_on_bg(front_img, args.bg_front)
    front_path = OUTPUT_DIR / "card_sample_front.png"
    front_img.save(front_path)
    print(f"앞면 저장됨 -> {front_path}")

    print("Calling Recraft for back side ...")
    back_img, _ = _call_image_api(back_prompt, seed=1002)
    back_img = _composite_on_bg(back_img, args.bg_back)
    back_path = OUTPUT_DIR / "card_sample_back.png"
    back_img.save(back_path)
    print(f"뒷면 저장됨 -> {back_path}")


if __name__ == "__main__":
    main()
