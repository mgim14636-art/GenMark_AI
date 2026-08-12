"""심볼 SVG에 브랜드명을 벡터로 붙여본다 (API 호출 없음, 무료).

    cd ai-server
    python scripts/try_svg_text.py
    python scripts/try_svg_text.py --brand 루나 --tone minimal
    python scripts/try_svg_text.py --src data/outputs/llm_compare/images_slim
    python scripts/try_svg_text.py --fonts        # 폰트 17종 글리프 추출 전수 검사

이미 뽑아둔 심볼 SVG를 재활용하므로 생성 비용이 들지 않는다.
결과: data/outputs/svg_text/<원본이름>_<브랜드명>.svg
"""
import os

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

DEFAULT_SRC = ROOT / "data" / "outputs" / "llm_compare" / "images_slim"
OUT_DIR = ROOT / "data" / "outputs" / "svg_text"

SURVEY = {
    "ci_bi": "CI",
    "company_name": "루나",
    "industry": "COSMETICS",
    "tone": "minimal",
    "style": "combination",
}


def check_fonts(brand: str) -> int:
    """폰트마다 글리프가 제대로 나오는지 확인한다.

    일부 한글 폰트는 글자를 조합형으로 만든다('루'를 ㄹ+ㅜ로 합성). 그런 폰트는
    완성형 글리프가 없어 윤곽선 추출이 비거나 깨질 수 있다. 미리 걸러둔다.
    """
    from app.services.svg_composer import _glyph_outlines
    from app.services import logo_composer

    fonts = sorted({p for pool in logo_composer._FONT_CANDIDATES.values() for p in pool})
    print(f"브랜드명 '{brand}' 기준, 폰트 {len(fonts)}개 검사\n")
    bad = 0
    for path in fonts:
        name = os.path.basename(path)
        if not os.path.exists(path):
            print(f"  ⚠️  {name:34} 파일 없음")
            continue
        try:
            paths, total, upem, asc, desc = _glyph_outlines(brand, path)
        except Exception as e:
            print(f"  ❌ {name:34} {type(e).__name__}: {e}")
            bad += 1
            continue
        ok = len(paths) == len(brand) and total > 0
        print(f"  {'✅' if ok else '❌'} {name:34} 글리프 {len(paths)}/{len(brand)} "
              f"· 폭 {total:.0f} · upem {upem}")
        if not ok:
            bad += 1
    print(f"\n{'문제 없음' if bad == 0 else f'{bad}개 폰트에 문제 있음'}")
    return 1 if bad else 0


def main(argv) -> int:
    src, brand, do_fonts = DEFAULT_SRC, None, False
    overrides = {}
    i = 0
    while i < len(argv):
        a = argv[i]
        nxt = argv[i + 1] if i + 1 < len(argv) else None
        if a == "--fonts":
            do_fonts = True
        elif a == "--src" and nxt:
            src = Path(nxt); i += 1
        elif a == "--brand" and nxt:
            brand = nxt; i += 1
        elif a == "--tone" and nxt:
            overrides["tone"] = nxt; i += 1
        elif a == "--style" and nxt:
            overrides["style"] = nxt; i += 1
        i += 1

    survey = dict(SURVEY, **overrides)
    if brand:
        survey["company_name"] = brand
    brand = survey["company_name"]

    if do_fonts:
        return check_fonts(brand)

    from app.services.svg_composer import compose_svg_logo, _ink_color

    files = sorted(src.glob("*.svg"))
    if not files:
        print(f"SVG가 없습니다: {src}")
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"원본 {len(files)}개 · 브랜드명 '{brand}' · 톤 {survey['tone']}\n")

    for n, f in enumerate(files):
        symbol = f.read_text(encoding="utf-8")
        try:
            out = compose_svg_logo(symbol, survey, variant_index=n)
        except Exception as e:
            print(f"  ❌ {f.name}: {type(e).__name__}: {e}")
            continue
        if out == symbol:
            print(f"  ⚠️  {f.name}: 텍스트가 합성되지 않았습니다 "
                  f"(style={survey['style']}, brand={brand})")
            continue
        dst = OUT_DIR / f"{f.stem}_{brand}.svg"
        dst.write_text(out, encoding="utf-8")
        before, after = len(symbol), len(out)
        print(f"  ✅ {f.name} → {dst.name}  잉크 {_ink_color(symbol)}  "
              f"{before:,}B → {after:,}B")

    print(f"\n완료. 폴더 열기: explorer {OUT_DIR}")
    print("SVG를 크롬에 드래그하면 바로 보입니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
