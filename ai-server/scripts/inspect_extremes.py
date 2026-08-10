"""생성 로고 중 최고·최저 유사도 케이스를 눈으로 검증한다.

코사인 0.95가 '진짜로 닮은 것'인지 '흰 배경·하단 텍스트 같은 공통 레이아웃 때문에
부풀려진 것'인지는 숫자만으로 판단할 수 없다. 상·하위 케이스의 비교 이미지를 만들어
사람이 직접 확인한다.

사용법
    cd ai-server
    python scripts/inspect_extremes.py          # 상위 5 + 하위 3
    python scripts/inspect_extremes.py 8 4

산출물
    data/outputs/extremes/TOP01_cos0.95_<파일명>.png
    data/outputs/extremes/BOT01_cos0.42_<파일명>.png
"""
import os

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

OUT_DIR = ROOT / "data" / "outputs"
DEST = OUT_DIR / "extremes"


def make_strip(query: Path, hits: list[tuple[float, str, str]], trademark_root: Path, dest: Path):
    """쿼리 + 상위 3건을 가로로 붙인다. hits = [(cos, 상표명, 이미지경로), ...]"""
    from PIL import Image, ImageDraw

    tile, pad, label_h = 300, 10, 40
    cells = [("쿼리", None, str(query))] + [
        (f"{c:.3f}", name, str(trademark_root / rel)) for c, name, rel in hits
    ]

    canvas = Image.new("RGB", (len(cells) * (tile + pad) + pad, tile + label_h + pad * 2), "white")
    draw = ImageDraw.Draw(canvas)

    for i, (label, name, path) in enumerate(cells):
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
            draw.text((x + 8, pad + tile // 2), "(없음)", fill="red")
        draw.text((x + 4, pad + tile + 6), label, fill="black")
        if name:
            draw.text((x + 4, pad + tile + 22), name[:22], fill="#555")

    canvas.save(dest)


def main() -> int:
    n_top = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    n_bot = int(sys.argv[2]) if len(sys.argv) > 2 else 3

    from app.core.config import settings
    from app.services.dino_service import DinoService
    from app.vector_store.index_manager import index_manager
    from app.vector_store.metadata_store import metadata_store

    vectors = index_manager.vectors
    trademark_root = Path(settings.trademark_data_root)
    paths = metadata_store.column("이미지경로")
    names = metadata_store.column("상표한글명") or [""] * len(paths)
    names_en = metadata_store.column("상표영문명") or [""] * len(paths)

    def label_of(i: int) -> str:
        for arr in (names, names_en):
            if i < len(arr) and str(arr[i]).strip() and str(arr[i]).strip().lower() != "nan":
                return str(arr[i]).strip()
        return "(무명)"

    samples = sorted((OUT_DIR / "samples").glob("gen_*.png"))
    samples += [p for p in sorted(OUT_DIR.glob("logo_*.png")) if "similarity_report" not in p.name]
    if not samples:
        print("표본이 없습니다. scripts/build_logo_samples.py 를 먼저 실행하세요.")
        return 1

    print(f"표본 {len(samples)}장 분석 중...", flush=True)
    rows = []
    for p in samples:
        try:
            q = np.array(DinoService.extract_features(str(p)), dtype=np.float32)
        except Exception:
            continue
        s = vectors @ q
        order = np.argsort(s)[::-1][:3]
        hits = [(float(s[i]), label_of(int(i)), paths[int(i)]) for i in order]
        rows.append((hits[0][0], p, hits))

    rows.sort(key=lambda r: -r[0])
    DEST.mkdir(parents=True, exist_ok=True)

    print(f"\n{'순위':>4} {'cos':>7}  {'스타일':<8} 파일 → 1위 상표")
    print("-" * 84)
    for rank, (c, p, hits) in enumerate(rows, 1):
        parts = p.stem.split("_")
        style = parts[2] if len(parts) >= 3 else "-"
        mark = "★" if rank <= n_top else ("·" if rank > len(rows) - n_bot else " ")
        print(f"{mark}{rank:>3} {c:>7.3f}  {style:<8} {p.name[:34]:<34} → {hits[0][1][:18]}")

    for i, (c, p, hits) in enumerate(rows[:n_top], 1):
        make_strip(p, hits, trademark_root, DEST / f"TOP{i:02d}_cos{c:.3f}_{p.stem}.png")
    for i, (c, p, hits) in enumerate(rows[-n_bot:], 1):
        make_strip(p, hits, trademark_root, DEST / f"BOT{i:02d}_cos{c:.3f}_{p.stem}.png")

    print(f"\n비교 이미지 {n_top + n_bot}장 저장: {DEST}")
    print("\n확인 포인트")
    print("  TOP — 정말 형태가 닮았는가? 아니면 흰 배경·하단 텍스트 때문인가?")
    print("        진짜 닮았다면 → 점수 체계 정상. CAUTION이 맞음")
    print("        레이아웃 탓이라면 → 심볼만 임베딩하거나 스타일 제한 필요")
    return 0


if __name__ == "__main__":
    sys.exit(main())
