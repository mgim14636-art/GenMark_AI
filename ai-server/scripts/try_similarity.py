"""생성 로고 → 상표 유사도 검색 스모크 테스트.

생성 파이프라인 산출물을 그대로 유사도 API에 태워, 기획서의 핵심 흐름
(생성 → 검증)이 실제로 끝까지 도는지 확인한다.

사용법:
    cd ai-server
    python scripts/try_similarity.py                      # logo_try_*.png + logo_v2_*.png 전부
    python scripts/try_similarity.py data/outputs/a.png   # 특정 파일

산출물:
    data/outputs/similarity_report_<파일명>.png   쿼리 + 상위 3건 비교 이미지
"""
import os

# Windows에서 torch와 faiss가 각각 OpenMP 런타임(libiomp5md / libomp140)을 링크해
# "OMP: Error #15"로 프로세스가 죽는다. 두 런타임 공존을 허용해 회피한다.
# torch·faiss가 import 되기 전에 설정해야 효과가 있다.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import base64
import sys
import time
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

OUT_DIR = ROOT / "data" / "outputs"


def collect_targets() -> list[Path]:
    if len(sys.argv) > 1:
        return [Path(p) for p in sys.argv[1:]]
    # v1(logo_try_*)과 v2(logo_v2_*) 결과를 모두 훑는다. 프롬프트 방식이 바뀌면
    # 유사도 점수가 어떻게 움직이는지 같은 실행에서 비교해야 하기 때문이다.
    found = sorted(OUT_DIR.glob("logo_try_*.png")) + sorted(OUT_DIR.glob("logo_v2_*.png"))
    if not found:
        found = sorted(OUT_DIR.glob("logo_test_*.png"))
    return found


# 리포트 라벨에 한글이 들어가므로 PIL 기본 비트맵 폰트로는 글자가 깨진다.
# 로고 합성용으로 이미 들어와 있는 한글 폰트를 재사용한다.
_FONT_CANDIDATES = (
    "app/fonts/modern_sans/regular/Pretendard-Regular.ttf",
    "app/fonts/modern_sans/bold/NanumGothicBold.ttf",
    "app/fonts/elegant_serif/regular/NanumMyeongjo-Regular.ttf",
)


def load_font(size: int = 18):
    from PIL import ImageFont

    for rel in _FONT_CANDIDATES:
        path = ROOT / rel
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size)
            except OSError:
                continue
    return ImageFont.load_default()


def build_report(query_path: Path, result: dict, trademark_root: Path) -> Path | None:
    """쿼리 이미지와 검출된 상표를 가로로 붙여 한 장으로 만든다."""
    from PIL import Image, ImageDraw

    tile = 320
    pad = 12
    label_h = 84
    f_big = load_font(20)
    f_mid = load_font(16)
    f_small = load_font(14)

    cells = [("쿼리 (생성 로고)", query_path, None)]
    for m in result["matches"]:
        p = trademark_root / m["imagePath"]
        cells.append((f"{m['rank']}위  {m['similarity']}점", p, m))

    canvas = Image.new(
        "RGB",
        (len(cells) * (tile + pad) + pad, tile + label_h * 2 + pad * 2),
        "white",
    )
    draw = ImageDraw.Draw(canvas)

    for i, (label, path, m) in enumerate(cells):
        x = pad + i * (tile + pad)
        try:
            im = Image.open(path)
            if im.mode in ("RGBA", "LA", "P"):
                im = im.convert("RGBA")
                bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
                im = Image.alpha_composite(bg, im)
            im = im.convert("RGB")
            im.thumbnail((tile, tile))
            canvas.paste(im, (x + (tile - im.width) // 2, pad + (tile - im.height) // 2))
        except Exception:
            draw.text((x + 8, pad + tile // 2), "(이미지 없음)", fill="red", font=f_mid)

        draw.text((x + 4, pad + tile + 8), label, fill="black", font=f_big)
        if m:
            draw.text((x + 4, pad + tile + 34), m["name"][:18], fill="#444", font=f_mid)
            draw.text((x + 4, pad + tile + 54), m["category"][:22], fill="#888", font=f_small)
            note = m.get("note")
            if note:
                # 20자에서 줄바꿈 — 타일 폭을 넘지 않게
                for li, chunk in enumerate([note[i:i + 20] for i in range(0, len(note), 20)][:2]):
                    draw.text((x + 4, pad + tile + 74 + li * 18), chunk, fill="#1a6", font=f_small)

    out = OUT_DIR / f"similarity_report_{query_path.stem}.png"
    canvas.save(out)
    return out


def main() -> int:
    targets = collect_targets()
    if not targets:
        print("검사할 이미지가 없습니다. 먼저 scripts/try_logo.py 를 실행하세요.")
        return 1

    from app.core.config import settings
    from app.core.readiness import get_state
    from app.services.similarity_service import SimilarityService

    state = get_state(refresh=True)
    print("=" * 70, flush=True)
    print(f"데이터 상태 : {'ready' if state.ready else 'NOT READY — ' + str(state.reason)}", flush=True)
    print(f"레코드      : {state.record_count}건 / {state.embedding_dimension}차원", flush=True)
    print(f"모델        : {state.model_id}", flush=True)
    print("=" * 70, flush=True)
    if not state.ready:
        return 1

    trademark_root = Path(settings.trademark_data_root)
    all_scores = []

    for path in targets:
        if not path.exists():
            print(f"\n건너뜀 (없음): {path}", flush=True)
            continue

        print(f"\n{'─' * 70}\n▶ {path.name}", flush=True)
        b64 = base64.b64encode(path.read_bytes()).decode()

        started = time.time()
        try:
            result = SimilarityService.process_similarity_search(b64, top_k=3)
        except Exception:
            print("  ❌ 검색 실패", flush=True)
            traceback.print_exc()
            continue

        elapsed = time.time() - started
        print(
            f"  최고 유사도 {result['maxSimilarity']}점  →  {result['riskLevel']}"
            f"   ({elapsed:.1f}초)",
            flush=True,
        )
        all_scores.append(result["maxSimilarity"])

        for m in result["matches"]:
            print(
                f"    {m['rank']}위 {m['similarity']:>3}점  "
                f"{m['applicationNumber']}  {m['name'][:16]:<16}  {m['category']}",
                flush=True,
            )
            if m.get("note"):
                print(f"         └ {m['note']}", flush=True)

        try:
            report = build_report(path, result, trademark_root)
            print(f"    비교 이미지: {report}", flush=True)
        except Exception as e:
            print(f"    (비교 이미지 생성 실패: {e})", flush=True)

    if all_scores:
        from collections import Counter

        def band(s):
            return "SAFE" if s < 30 else ("MODERATE" if s < 60 else "CAUTION")

        dist = Counter(band(s) for s in all_scores)
        print(f"\n{'=' * 70}")
        print(f"요약 — {len(all_scores)}건")
        print(f"  점수 범위 : {min(all_scores)} ~ {max(all_scores)}")
        print(f"  평균      : {sum(all_scores) / len(all_scores):.1f}")
        for level in ("SAFE", "MODERATE", "CAUTION"):
            print(f"  {level:<9}: {dist.get(level, 0)}건")
        print("=" * 70)

    return 0


if __name__ == "__main__":
    sys.exit(main())
