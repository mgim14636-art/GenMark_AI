"""심볼 SVG + 브랜드명 = 최종 벡터 로고.

logo_composer가 PIL로 픽셀에 글자를 그리는 것과 같은 일을, 벡터 좌표로 한다.

왜 따로 만드는가
    Recraft 벡터 모델로 바꾸면서 심볼이 SVG로 온다. 그런데 글자를 PIL로 얹는
    순간 결과물이 다시 래스터가 되어, 명함·간판까지 한 원본으로 쓰려던 이유가
    사라진다. 글자도 벡터로 붙여야 끝까지 벡터로 남는다.

왜 <text> 태그를 안 쓰는가
    보는 사람 컴퓨터에 그 폰트가 없으면 다른 글꼴로 대체되어 로고가 달라진다.
    글리프를 윤곽선(path)으로 변환해 넣으면 폰트 파일 없이도 항상 같게 보이고,
    OFL 관점에서도 폰트 재배포가 아니라 도형이 된다.

logo_composer와의 관계
    폰트 선택·자간·크기 규칙은 logo_composer에서 그대로 가져다 쓴다.
    "무엇을 얼마나 크게"는 렌더링 방식과 무관하기 때문이다.
    PIL 경로(compose_final_logo)는 그대로 둔다 — 유사도 분석이 래스터를 쓴다.
"""
import re
from typing import Optional

from app.services import logo_composer

# 심볼 캔버스 폭 대비 글자 크기. logo_composer.compose_logo_with_text의
# font_size_ratio와 같은 값을 쓴다 (래스터/벡터 결과가 달라 보이면 안 된다).
FONT_SIZE_RATIO = 0.115
GAP_RATIO = 0.55          # 심볼과 글자 사이 간격 (글자 크기 대비)
MAX_TEXT_WIDTH_RATIO = 0.82   # 긴 브랜드명은 이 폭에 맞춰 줄인다


def _viewbox(svg: str):
    m = re.search(r'viewBox="\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)', svg)
    if not m:
        return 0.0, 0.0, 1024.0, 1024.0
    return tuple(float(m.group(i)) for i in (1, 2, 3, 4))


def _ink_color(svg: str, default: str = "rgb(30,30,34)") -> str:
    """심볼이 실제로 쓴 색을 글자 색으로 가져온다.

    가장 넓게 쓰인 색이 아니라 '흰색이 아닌 색 중 가장 자주 나오는 것'을 고른다.
    배경을 지운 뒤라도 흰색 path(파내기)가 남아 있을 수 있어서다.
    """
    counts = {}
    for r, g, b in re.findall(r'fill="rgb\((\d+),\s*(\d+),\s*(\d+)\)"', svg):
        rgb = (int(r), int(g), int(b))
        if min(rgb) > 240:            # 흰색·거의 흰색은 잉크가 아니다
            continue
        counts[rgb] = counts.get(rgb, 0) + 1
    if not counts:
        return default
    rgb = max(counts.items(), key=lambda kv: kv[1])[0]
    return f"rgb({rgb[0]},{rgb[1]},{rgb[2]})"


def _glyph_outlines(text: str, font_path: str, letter_spacing: float = 0.0):
    """글자별 윤곽선을 뽑는다.

    반환: (paths, total_width, upem, ascender, descender)
        paths — [(path_d, x_offset)] , 폰트 단위 좌표
        letter_spacing은 em 대비 비율 (logo_composer의 자간과 같은 의미)

    폰트 좌표계는 y축이 위로 향하고, SVG는 아래로 향한다. 뒤집기는 호출부에서
    transform으로 처리한다 — 여기서 좌표를 건드리면 커닝 계산이 꼬인다.
    """
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.ttLib import TTFont

    font = TTFont(font_path, fontNumber=0, lazy=True)
    try:
        upem = font["head"].unitsPerEm
        ascender = font["hhea"].ascent
        descender = font["hhea"].descent
        cmap = font.getBestCmap()
        glyphset = font.getGlyphSet()
        hmtx = font["hmtx"]

        spacing_units = letter_spacing * upem
        paths, x = [], 0.0
        for ch in text:
            gname = cmap.get(ord(ch))
            if gname is None:
                # 폰트에 없는 글자 — 공백만큼 띄우고 넘어간다.
                # 로고에서 두부(□)가 찍히는 것보다 낫다.
                x += upem * 0.4 + spacing_units
                continue
            pen = SVGPathPen(glyphset)
            glyphset[gname].draw(pen)
            d = pen.getCommands()
            if d.strip():
                paths.append((d, x))
            x += hmtx[gname][0] + spacing_units

        # 마지막 글자 뒤의 자간은 폭에 포함하지 않는다 (가운데 정렬이 틀어진다)
        total = x - spacing_units if text else 0.0
        return paths, total, upem, ascender, descender
    finally:
        font.close()


def compose_svg_logo(
    symbol_svg: str,
    survey: dict,
    variant_index: int = 0,
    ink: Optional[str] = None,
) -> str:
    """심볼 SVG 아래에 브랜드명을 벡터로 붙인 최종 로고를 돌려준다.

    브랜드명이 없거나 '심볼' 스타일이면 심볼을 그대로 돌려준다
    (logo_composer._wants_text_overlay와 같은 판단을 쓴다).
    """
    from app.services.prompt_service import _normalize_survey, _normalize_tone

    survey = _normalize_survey(survey)
    brand_name = (survey.get("brand_name") or "").strip()
    style_key = survey.get("style", "")

    if not logo_composer._wants_text_overlay(survey, style_key, brand_name):
        return symbol_svg

    text = (
        logo_composer._initials(brand_name)
        if style_key == "레터마크"
        else brand_name
    )
    if not text:
        return symbol_svg

    tone = _normalize_tone(survey.get("tone", ""))
    weight, letter_spacing = logo_composer._pick_text_style(tone, variant_index)
    font_path = logo_composer._resolve_font_path_for_call(
        None, weight, tone, variant_index
    )
    if not font_path:
        return symbol_svg

    paths, text_units, upem, ascender, descender = _glyph_outlines(
        text, font_path, letter_spacing
    )
    if not paths or text_units <= 0:
        return symbol_svg

    vx, vy, vw, vh = _viewbox(symbol_svg)
    ink = ink or _ink_color(symbol_svg)

    # 글자 크기: 캔버스 폭 기준. 긴 브랜드명은 폭에 맞춰 줄인다.
    # (심볼 bbox 기준으로 잡으면 심볼이 작을 때 글자가 같이 초라해진다 — 실측)
    font_size = vw * FONT_SIZE_RATIO
    scale = font_size / upem
    if text_units * scale > vw * MAX_TEXT_WIDTH_RATIO:
        scale = (vw * MAX_TEXT_WIDTH_RATIO) / text_units
        font_size = upem * scale

    gap = font_size * GAP_RATIO
    text_h = (ascender - descender) * scale
    new_h = vh + gap + text_h

    # 가로 가운데 정렬, 세로는 심볼 아래 + 간격 + 어센더만큼 내려간 지점이 baseline
    tx = vx + (vw - text_units * scale) / 2
    ty = vy + vh + gap + ascender * scale

    glyphs = "\n    ".join(
        f'<path d="{d}" transform="translate({tx + x * scale:.2f},{ty:.2f}) '
        f'scale({scale:.6f},{-scale:.6f})" fill="{ink}"/>'
        for d, x in paths
    )

    body = _strip_svg_wrapper(symbol_svg)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" version="1.1" '
        f'viewBox="{vx} {vy} {vw} {new_h:.2f}" '
        f'width="{vw:.0f}" height="{new_h:.0f}">\n'
        f'  <g id="symbol">{body}</g>\n'
        f'  <g id="wordmark">\n    {glyphs}\n  </g>\n'
        f'</svg>'
    )


def _strip_svg_wrapper(svg: str) -> str:
    """바깥 <svg> 태그와 메타데이터를 걷어내고 알맹이만 남긴다.

    Recraft 응답에는 C2PA 매니페스트(생성 이력 서명)가 <metadata>로 붙어 온다.
    수십 KB짜리라 그대로 두면 파일이 불필요하게 커지고, 두 SVG를 합칠 때
    메타데이터가 중복된다.
    """
    inner = re.sub(r"^.*?<svg[^>]*>", "", svg, count=1, flags=re.S)
    inner = re.sub(r"</svg>\s*$", "", inner, flags=re.S)
    inner = re.sub(r"<metadata>.*?</metadata>", "", inner, flags=re.S)
    return inner.strip()
