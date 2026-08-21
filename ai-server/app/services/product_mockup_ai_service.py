"""AI 이미지 편집 모델로 완성된 로고를 실제 목업 사진의 라벨에 합성한다.

product_mockup.py / brand_kit.py는 PIL로 라벨 영역(4개 꼭짓점)을 직접 지정해 로고를
원근 변형해 끼워 넣는다. 목업 사진이 한 장뿐이면 브랜드가 뭐든 항상 같은 장면이
나온다는 한계가 있어(brand_kit_service.py의 PRODUCT_THUMBNAIL 전환 배경 참고),
그쪽은 AI가 장면을 통째로 새로 그리는 방식(_generate_ai_product_scene)으로 바꾼 적도
있다.

이번엔 절충안이다. 목업 사진을 3장(top_left / top_right / bottom_left, 서로 다른
배경·조명) 준비해 장면 다양성은 실제 촬영 사진으로 확보하고, 로고를 병 라벨에
자연스럽게 "인쇄"하는 작업만 AI 이미지 편집 모델(다중 레퍼런스 편집을 지원하는
FLUX.2 Pro)에 맡긴다.

[크기 조절 실측 기록 — 2026-08-20] 처음에는 목업 사진 + 로고 2장만 레퍼런스로 주고
"작게, 라벨 폭의 1/3 이하로" 같은 말로만 크기를 지시했다. 실측 결과 모델이 텍스트
크기 지시를 거의 따르지 않았다(1/3 지시 → 실제로는 병 폭의 70~80%, "골드 캡보다
작게"로 더 강하게 지시해도 거의 줄지 않음) — 디퓨전 편집 모델은 상대적 크기 서술어에
잘 반응하지 않는다. 그래서 세 번째 레퍼런스로 "크기·위치 가이드"(_size_guide)를
추가했다: 원근·조명은 무시한 채 로고를 목업 사진 위 대략적인 실제 크기로 미리
붙여넣은 이미지다. 모델에게 "이 가이드와 정확히 같은 크기로"라고 지시하면 텍스트
설명보다 픽셀로 보여주는 쪽이 훨씬 잘 지켜진다. 로고 모양·색은 레퍼런스 2(원본
로고)를 따르게 하고, 크기·위치만 레퍼런스 3(가이드)을 따르게 하는 역할 분담이다.

트레이드오프: 디퓨전 모델은 입력 이미지를 픽셀 단위로 그대로 재현하지 못한다. 로고
형태·색이 미묘하게 달라질 수 있고, 브랜드명 텍스트(특히 한글)나 기존 목업의 영문
카피는 편집 과정에서 철자가 흔들릴 위험이 있다(실측 확인됨 — 기존 "MADE IN KOREA"
같은 문구가 존재하지 않는 유사 단어로 바뀜). 정확도가 최우선이면
product_mockup.compose_product_thumbnail(PIL 합성)을 대신 쓴다.
"""
import os
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from app.services.logo_gen_service import _call_image_api
from app.services.product_mockup import _remove_flat_background

_ASSET_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")

# 세 목업 모두 같은 3점 세트(스프레이 병 / 크림 자 / 드로퍼 병)를 서로 다른
# 배경·조명으로 촬영한 사진이다. 실측 703~704 x 384px, 약 1.83:1 — API에는 가장
# 가까운 지원 비율(16:9)로 요청한다.
#
# 세 사진 모두 별도 종이 라벨이 없다 — 스프레이 병·드로퍼 병에는 프로스트 유리
# 표면에 작은 회색 글자(제품명 + "100mL" + "MADE IN ..." 줄)가 직접 인쇄돼 있고,
# 자(jar)에는 인쇄가 아예 없다(실측 확인, 2026-08-20). _edit_prompt가 이 사실을
# 그대로 모델에게 알려줘야 한다 — 그렇지 않으면 모델이 없는 흰 라벨지를 새로
# 그려 넣거나(1차 시도에서 실측 확인됨) 기존 인쇄 문구를 지워버린다.
MOCKUP_TEMPLATES = {
    "top_left": os.path.join(_ASSET_DIR, "top_left.png"),
    "top_right": os.path.join(_ASSET_DIR, "top_right.png"),
    "bottom_left": os.path.join(_ASSET_DIR, "bottom_left.png"),
}

# brand_kit_service의 AI 제품 사진 생성과 같은 모델을 재사용한다 — 이미 편집(레퍼런스
# 이미지 최대 8장) 지원이 확인된 사진풍 모델이라 별도 환경변수를 늘리지 않는다.
_EDIT_MODEL = os.environ.get("OPENROUTER_BACKGROUND_MODEL", "black-forest-labs/flux.2-pro")


@dataclass(frozen=True)
class _LogoAnchor:
    """로고를 얹을 대략적인 위치·크기(이미지 폭 대비 비율). 원근 보정은 안 한다 —
    크기·위치 감만 잡아주면 되고, 실제 곡률·원근은 AI가 다시 그린다."""
    cx: float
    cy: float
    size: float


# 703~704x384 목업 이미지에 격자를 겹쳐 그려 눈대중으로 잰 좌표(실측, 2026-08-20).
# 순서: [스프레이 병, 자, 드로퍼 병].
#
# [실측] 스프레이 병(중앙, 가장 큰 병)은 모델이 가이드보다 계속 크게 그리는 편향이
# 있었다(2026-08-20 반복 확인 — 자·드로퍼는 가이드 크기를 잘 따르는데 스프레이만
# 유독 커짐). 프롬프트만으로는 못 잡아서 스프레이 쪽 가이드 크기를 미리 더 작게
# 줄여 보정했다.
#
# [실측] composite_logo_onto_mockup에서 로고 레퍼런스에 _remove_flat_background를
# 적용해 실제 알파 투명 배경으로 만들자(용기 밖 배치·자 로고 누락 버그 수정),
# _size_guide의 트리밍이 로고 주변 여백까지 정확히 잘라내면서 같은 size 값이라도
# 가이드에 찍히는 잉크 자체가 훨씬 커졌다(잉크가 실제로 카드 폭의 ~59%만 차지했는데
# 트리밍 전에는 카드 전체 크기 기준으로 리사이즈됐기 때문 — 실측). 그 결과 로고가
# 다시 커져 보이는 부작용이 생겨, 아래 값들은 그 확대분을 상쇄하려고 이전 값 대비
# 약 0.55배로 줄여뒀다.
_ANCHORS = {
    "top_left": [
        _LogoAnchor(0.534, 0.42, 0.015),
        _LogoAnchor(0.401, 0.677, 0.024),
        _LogoAnchor(0.636, 0.42, 0.020),
    ],
    "top_right": [
        _LogoAnchor(0.533, 0.42, 0.014),
        _LogoAnchor(0.401, 0.703, 0.020),
        _LogoAnchor(0.629, 0.56, 0.017),
    ],
    "bottom_left": [
        _LogoAnchor(0.538, 0.48, 0.014),
        _LogoAnchor(0.398, 0.729, 0.020),
        _LogoAnchor(0.667, 0.54, 0.017),
    ],
}


def _size_guide(mockup: Image.Image, logo: Image.Image, template: str) -> Image.Image:
    """로고를 목업 사진 위 대략적인 크기·위치로 미리 붙여넣은 가이드 이미지.

    원근·조명·곡률은 완전히 무시한다(그냥 납작하게 붙여넣기만 함) — 목적은 AI에게
    "이 정도 크기, 이 자리"라는 감을 픽셀로 정확히 전달하는 것뿐이다. 실제 통합은
    AI가 _edit_prompt 지시에 따라 다시 그린다.
    """
    guide = mockup.convert("RGBA").copy()
    w, h = guide.size
    trimmed = logo.convert("RGBA")
    bbox = trimmed.getbbox()
    if bbox:
        trimmed = trimmed.crop(bbox)
    for anchor in _ANCHORS.get(template, []):
        side = max(int(round(anchor.size * w)), 1)
        ratio = min(side / trimmed.width, side / trimmed.height)
        size = (max(1, round(trimmed.width * ratio)), max(1, round(trimmed.height * ratio)))
        resized = trimmed.resize(size, Image.LANCZOS)
        cx, cy = round(anchor.cx * w), round(anchor.cy * h)
        pos = (cx - resized.width // 2, cy - resized.height // 2)
        guide.paste(resized, pos, resized)
    return guide


@dataclass(frozen=True)
class _TextRegion:
    """이미지 폭·높이 대비 비율(0~1)로 잡은, 기존 인쇄 문구가 있는 직사각형."""
    left: float
    top: float
    right: float
    bottom: float


# 격자 오버레이로 실측한(2026-08-20) 스프레이 병·드로퍼 병의 기존 영문 카피 위치.
# AI 편집이 이 문구를 그대로 못 베끼고 다른 단어로 바꿔버리는 문제가 있어(실측
# 확인됨), _restore_original_text가 편집 후 이 영역만 원본 사진 그대로 되돌린다.
# 자(jar)는 원래 인쇄가 없어 대상에서 뺐다.
_TEXT_REGIONS = {
    "top_left": [
        _TextRegion(0.434, 0.521, 0.597, 0.794),
        _TextRegion(0.576, 0.521, 0.697, 0.781),
    ],
    "top_right": [
        _TextRegion(0.447, 0.534, 0.590, 0.768),
        _TextRegion(0.568, 0.690, 0.696, 0.846),
    ],
    "bottom_left": [
        _TextRegion(0.441, 0.586, 0.569, 0.794),
        _TextRegion(0.590, 0.677, 0.711, 0.833),
    ],
}


def _logo_ink_color(logo_rgba: Image.Image):
    """로고의 불투명 픽셀 대표색(중앙값)을 구한다. 배경 오탐 없이 로고를 색으로
    찾아내는 데 쓴다 — 로고 잉크는 채도 있는 단색인 반면 배경(나무 탁자·액자 등)은
    색이 달라 오차범위 안에서 거의 겹치지 않는다(실측 확인됨)."""
    arr = np.asarray(logo_rgba.convert("RGBA"))
    opaque = arr[:, :, 3] > 200
    if not opaque.any():
        return None
    rgb = arr[:, :, :3][opaque].astype(np.float64)
    return tuple(np.median(rgb, axis=0))


def _detect_logo_bbox(image_rgb: Image.Image, x_range: tuple, target_color, tol: float = 22, min_hits: int = 15):
    """target_color와 색이 가까운 픽셀들의 바운딩 박스를 x_range(폭 비율) 안에서 찾는다.

    실측(2026-08-20): 톨러런스 22 정도면 로고 잉크만 깔끔하게 걸리고 나무 탁자·
    액자 같은 따뜻한 색 배경은 안 걸린다(threshold sweep으로 확인). 못 찾으면 None —
    호출부가 대략적인 앵커 위치로 대체한다.
    """
    W, H = image_rgb.size
    pad = round(0.03 * W)
    left = max(round(x_range[0] * W) - pad, 0)
    right = min(round(x_range[1] * W) + pad, W)
    if right <= left:
        return None
    crop = np.asarray(image_rgb.crop((left, 0, right, H))).astype(np.float64)
    dist = np.sqrt(((crop - np.asarray(target_color, dtype=np.float64)) ** 2).sum(axis=2))
    ys, xs = np.where(dist < tol)
    if len(xs) < min_hits:
        return None
    return (left + int(xs.min()), int(ys.min()), left + int(xs.max()), int(ys.max()))


def _restore_original_text(
    mockup: Image.Image, result: Image.Image, template: str, logo_rgba: Image.Image = None
) -> Image.Image:
    """AI 편집으로 바뀐 기존 인쇄 문구를, 그 영역만 원본 사진 그대로 되돌린다.

    원본과 결과물 해상도가 다를 수 있어(요청 aspect_ratio 16:9가 원본의 실제
    비율 약 1.83:1과 정확히 같지 않음) 원본을 결과물 크기에 맞춰 리사이즈한 뒤,
    가장자리를 블러 처리한 마스크로 합성해 딱딱한 사각형 이음매가 보이지 않게 한다.

    [실측 — 2026-08-20] 처음엔 텍스트 영역만 복원했더니 스프레이·드로퍼 병의 로고까지
    같이 지워졌다 — _edit_prompt가 "기존 텍스트 바로 위에 로고"라고 지시하지만 AI가
    가이드(_size_guide)의 위치를 거의 따르지 않고 라벨 영역(=기존 텍스트가 있던
    자리)에 훨씬 가깝게 그렸다(실측: 가이드는 cy=0.42인데 실제로는 0.52~0.66에
    그려짐 — 앵커 좌표를 그대로 믿고 구멍을 뚫으면 못 잡는다). 그래서 앵커 좌표 대신
    _detect_logo_bbox로 결과물에서 로고 잉크색을 실제로 찾아 그 자리를 뚫는다 —
    AI가 어디에 그렸든 실측 위치를 그대로 따라가므로 훨씬 안정적이다. 색 검출이
    실패하면(로고가 없거나 색이 너무 옅게 나옴) 앵커 좌표를 대체 위치로 쓴다.
    """
    regions = _TEXT_REGIONS.get(template, [])
    if not regions:
        return result
    out = result.convert("RGB")
    W, H = out.size
    base = mockup.convert("RGB").resize((W, H), Image.LANCZOS)

    mask = Image.new("L", (W, H), 0)
    mdraw = ImageDraw.Draw(mask)
    for region in regions:
        box = (
            round(region.left * W), round(region.top * H),
            round(region.right * W), round(region.bottom * H),
        )
        mdraw.rectangle(box, fill=255)

    target = _logo_ink_color(logo_rgba) if logo_rgba is not None else None
    # _ANCHORS 순서는 [스프레이, 자, 드로퍼]지만 _TEXT_REGIONS는 텍스트가 있는
    # [스프레이, 드로퍼]만 담는다 — 자를 건너뛴 인덱스로 앵커를 짝지어야 한다.
    anchors = _ANCHORS.get(template, [])
    fallback_anchor_by_region = [anchors[0] if anchors else None, anchors[2] if len(anchors) > 2 else None]
    for i, region in enumerate(regions):
        anchor = fallback_anchor_by_region[i] if i < len(fallback_anchor_by_region) else None
        hole = _detect_logo_bbox(out, (region.left, region.right), target) if target is not None else None
        if hole:
            l, t, r, b = hole
            # [실측 — 2026-08-20] bottom_left처럼 노을빛이 도는 배경에서는 로고의
            # 코랄색과 가까운 색(금색 반사·따뜻한 톤 벽)이 넓게 걸려 검출 박스가
            # 텍스트 영역 전체만큼 커지는 오탐이 있었다. 로고 앵커 크기 대비 지나치게
            # 크면 오탐으로 보고 버리고 앵커 기반 자리로 대체한다.
            max_dim = max((anchor.size * W * 6) if anchor else W, 40)
            if (r - l) > max_dim or (b - t) > max_dim:
                hole = None
        if hole:
            l, t, r, b = hole
            pad_x = max(round((r - l) * 0.4), 10)
            pad_y = max(round((b - t) * 0.4), 10)
            mdraw.ellipse((l - pad_x, t - pad_y, r + pad_x, b + pad_y), fill=0)
        elif anchor is not None:
            # 색 검출 실패(또는 오탐으로 버려짐) 시의 대체 경로 — 가이드 앵커 위치를
            # 넉넉하게 뚫어둔다.
            rr = max(round(anchor.size * W * 3.5), 14)
            cx, cy = round(anchor.cx * W), round(anchor.cy * H)
            mdraw.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=0)

    # [실측 — 2026-08-20] 블러가 크면(폭의 1.2%) 텍스트 사각형과 로고 구멍의 경계가
    # 글자를 가로지르는 자리에서 원본·AI 글자가 반투명하게 겹쳐 "이중 노출"처럼
    # 보였다(둘 다 위치가 다른 글자라 섞이면 읽을 수 없는 얼룩이 됨). 사진 이음매
    # 티가 좀 나더라도 글자가 안 깨지는 쪽이 나아서 블러를 최소로 줄였다.
    feather = 2
    mask = mask.filter(ImageFilter.GaussianBlur(feather))

    composited = out.copy()
    composited.paste(base, (0, 0), mask)
    return composited


def _edit_prompt(brand_name: str) -> str:
    name_hint = (
        f' If the logo has no readable text on it, you may add the brand name "{brand_name}" '
        f'as a separate line of tiny type directly above the existing product copy — same '
        f'small size as that copy, not larger. If the logo already contains its own text, '
        f'do not add the name again.'
        if brand_name else ""
    )
    return (
        "You are editing reference image 1, a photo of three frosted-glass cosmetic "
        "containers: a spray bottle (center, tallest), a jar (left), a dropper bottle "
        "(right). The spray bottle and dropper bottle already have a few lines of small "
        "gray text printed directly onto the glass (no paper label). The jar has no "
        "printing yet. Reference image 2 is a brand logo (transparent background) — copy "
        "its exact shape and color. Reference image 3 is a flat, low-quality preview "
        "showing exactly where and how big that logo should be on each container — ignore "
        "its flat look and wrong perspective, but its size is the exact target, do not "
        "guess a different size.\n\n"
        "Apply the logo to all three containers, matching reference image 3 for each:\n"
        "1. Spray bottle: tiny logo above the existing text, same tiny size as in "
        "reference image 3 — it must stay just as small as on the other two containers, "
        "being the tallest bottle is not a reason to enlarge it.\n"
        "2. Jar: add the tiny logo centered on the front — this one currently has nothing "
        "printed on it, so do not leave it blank.\n"
        "3. Dropper bottle: tiny logo above the existing text, same tiny size as in "
        "reference image 3.\n\n"
        "For all three: print the logo directly onto the frosted glass like the existing "
        "text (do not add any new white sticker, paper label, or solid patch behind it — "
        "glass stays visible around it), wrap it to the glass's curvature and match the "
        "existing lighting and reflections. Do not remove, move, or resize any existing "
        "printed text on the spray or dropper bottle. The logo must appear ONLY on the "
        "glass surface of these three containers — never on the wooden table, tray, paper "
        "card underneath, flasks, plants, picture frames, or any other prop or empty space "
        "in the scene."
        f"{name_hint} "
        "Everything else in reference image 1 — container shapes, cap colors, positions, "
        "background, props, surface, lighting, camera angle — stays identical. No other "
        "new text or graphics."
    )


def composite_logo_onto_mockup(
    logo: Image.Image, template: str = "top_left", brand_name: str = ""
) -> Image.Image:
    """완성된 로고(logo_composer.compose_final_logo 결과물)를 지정한 목업 사진에 AI로 합성한다."""
    path = MOCKUP_TEMPLATES.get(template)
    if not path:
        raise ValueError(
            f"알 수 없는 목업 템플릿입니다: {template!r} (사용 가능: {list(MOCKUP_TEMPLATES)})"
        )
    mockup = Image.open(path).convert("RGBA")
    # compose_final_logo가 내보내는 로고는 흰 배경 위에 그려진 "불투명" PNG다
    # (alpha=255 전체 — 실측 확인, 2026-08-20). 이걸 그대로 레퍼런스로 넘기면
    # 프롬프트는 "투명 배경"이라 말하는데 실제로는 흰 사각형 전체가 로고의 일부인
    # 셈이라, 모델이 그 흰 사각형을 용기 밖 빈 공간에 그대로 옮겨 그리거나(로고가
    # 용기 밖에 나타남) 가이드 합성 시 흰 배경째로 붙어(_size_guide가 진짜 투명
    # 마스크 대신 불투명 사각형을 붙이게 됨) 자(jar)처럼 여백이 좁은 용기에서
    # 통째로 무시되는 원인이 됐다(실측 확인됨). product_mockup._remove_flat_background
    # 로 실제 알파 투명 배경을 만든 뒤에만 레퍼런스·가이드에 쓴다.
    logo_rgba = _remove_flat_background(logo.convert("RGBA"))
    guide = _size_guide(mockup, logo_rgba, template)

    image, _svg = _call_image_api(
        _edit_prompt(brand_name),
        model=_EDIT_MODEL,
        input_references=[mockup, logo_rgba, guide],
        aspect_ratio="16:9",
    )
    image = _restore_original_text(mockup, image, template, logo_rgba)
    return image.convert("RGB")


def composite_logo_onto_all_mockups(logo: Image.Image, brand_name: str = "") -> dict:
    """3개 목업 전부에 같은 로고를 합성한다. 반환: {템플릿 이름: PIL 이미지}."""
    return {
        name: composite_logo_onto_mockup(logo, template=name, brand_name=brand_name)
        for name in MOCKUP_TEMPLATES
    }
