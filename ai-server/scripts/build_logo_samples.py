"""점수 캘리브레이션용 생성 로고 표본 만들기.

앵커를 정하려면 '무관한 생성 로고'의 top-1 코사인 분포가 필요하다.
표본이 편향되지 않도록 브랜드명·스타일·톤·색상을 골고루 섞어 생성한다.

사용법
    cd ai-server
    python scripts/build_logo_samples.py           # 32장
    python scripts/build_logo_samples.py 60        # 60장

산출물
    data/outputs/samples/gen_0001_혼합형_모던.png ...

이미 있는 파일은 건너뛴다(이어받기 가능). 중간에 Ctrl+C 해도 그때까지 만든 건 남는다.
"""
import os

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import hashlib
import io
import random
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

OUT_DIR = ROOT / "data" / "outputs" / "samples"
VARIANTS_PER_CALL = 4  # 1회 호출당 시안 수 (병렬 처리되므로 4가 효율적)

# prompt_service.STYLE_MAP 과 일치해야 한다
STYLES = ["심볼", "워드마크", "혼합형", "레터마크"]

# prompt_service 의 톤 키와 일치해야 한다
TONES = [
    "친근하고 다정한",
    "전문적이고 신뢰감 있는",
    "감성적이고 따뜻한",
    "유니크하고 트렌디한",
    "미니얼하고 직관적인",
]

BRANDS = [
    "Aurora", "Bellis", "Cielo", "Dewy", "Elowen", "Foret", "Glow", "Haneul",
    "Inara", "Jelly", "Kalmia", "Lumen", "Muse", "Nubi", "Onda", "Petal",
    "Quiet", "Rosea", "Serein", "Tidal", "Umbra", "Verde", "Wisp", "Yuzu",
]

VALUES = [
    ["자연", "순수"], ["신뢰", "전문성"], ["활력", "생기"], ["고급", "우아함"],
    ["편안함", "휴식"], ["혁신", "실험"], ["지속가능", "친환경"], ["섬세함", "정교함"],
]

COLORS = [
    "#2E7D6B", "#D98C8C", "#3A4A7A", "#C9A227", "#7A5C99",
    "#1F2933", "#E07A5F", "#4F9D69", "#B36A93", "#8C6D46",
]


def main() -> int:
    target = int(sys.argv[1]) if len(sys.argv) > 1 else 32
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    existing = sorted(OUT_DIR.glob("gen_*.png"))
    print(f"목표 {target}장 | 기존 {len(existing)}장 | 저장 위치 {OUT_DIR}", flush=True)
    if len(existing) >= target:
        print("이미 목표치를 채웠습니다. 더 필요하면 인자를 늘리세요.")
        return 0

    from app.services import flux_service, logo_composer

    if not flux_service.NVIDIA_API_KEY:
        print("NVIDIA_API_KEY가 없습니다. ai-server/.env를 확인하세요.")
        return 1
    print(f"URL: {flux_service.NVIDIA_API_URL}\n", flush=True)

    rng = random.Random(20260810)
    per_style = max(1, target // len(STYLES))
    print(f"스타일당 {per_style}장씩 균등 생성 (스타일 {len(STYLES)}종)\n", flush=True)

    # 이미 있는 파일의 스타일별 개수와 내용 해시(중복 방지)
    have = {s: 0 for s in STYLES}
    seen: set[str] = set()
    for p in existing:
        parts = p.stem.split("_")
        if len(parts) >= 3 and parts[2] in have:
            have[parts[2]] += 1
        seen.add(hashlib.md5(p.read_bytes()).hexdigest())

    made = len(existing)
    seq = made + 1
    started = time.time()
    dup_skipped = 0

    for style in STYLES:
        # 워드마크·레터마크는 브랜드명 글자만 쓰므로 variant를 여러 개 요청해도
        # 같은 그림이 나온다. 호출당 1장만 받고 브랜드를 매번 바꿔 다양성을 확보한다.
        text_only = style in ("워드마크", "레터마크")
        per_call = 1 if text_only else VARIANTS_PER_CALL

        fails = 0
        while have[style] < per_style:
            tone = rng.choice(TONES)
            survey = {
                "ci_bi": rng.choice(["CI", "BI"]),
                "brand_name": rng.choice(BRANDS),
                "industry": "뷰티",
                "style": style,
                "tone": tone,
                "brand_values": rng.choice(VALUES),
                "color_mode": "manual",
                "color_manual": [rng.choice(COLORS)],
            }
            want = min(per_call, per_style - have[style])

            try:
                symbols = flux_service.generate_logo_from_survey(survey, num_variants=want)
            except KeyboardInterrupt:
                print("\n중단됨. 지금까지 만든 표본은 유지됩니다.", flush=True)
                return 0
            except Exception as e:
                fails += 1
                print(f"  실패 ({style}): {type(e).__name__} {str(e)[:70]}", flush=True)
                if fails >= 3:
                    print(f"  {style} 연속 실패 — 다음 스타일로 넘어갑니다.", flush=True)
                    break
                continue
            fails = 0

            for symbol in symbols:
                try:
                    logo = logo_composer.compose_final_logo(symbol, survey)
                except Exception as e:
                    print(f"  합성 실패: {type(e).__name__}", flush=True)
                    continue

                # 내용이 같은 이미지는 표본에서 제외 — 중복은 분포를 왜곡한다
                buf = io.BytesIO()
                logo.save(buf, format="PNG")
                digest = hashlib.md5(buf.getvalue()).hexdigest()
                if digest in seen:
                    dup_skipped += 1
                    continue
                seen.add(digest)

                path = OUT_DIR / f"gen_{seq:04d}_{style}_{tone.split()[0]}.png"
                path.write_bytes(buf.getvalue())
                have[style] += 1
                made += 1
                seq += 1

            print(
                f"  [{style}] {have[style]}/{per_style}  "
                f"(전체 {made}, {time.time() - started:.0f}초, 중복제외 {dup_skipped})",
                flush=True,
            )

    print(f"\n완료 — 총 {made}장, 중복 제외 {dup_skipped}장  ({time.time() - started:.0f}초)")
    print("  스타일별: " + ", ".join(f"{s} {have[s]}" for s in STYLES))
    print(f"위치: {OUT_DIR}")
    print("\n다음 단계:")
    print("  python scripts/calibrate_score.py 30")
    return 0


if __name__ == "__main__":
    sys.exit(main())
