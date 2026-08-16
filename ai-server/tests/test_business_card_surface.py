# -*- coding: utf-8 -*-
"""명함 표면 규칙 — 뒷면은 흰색, 로고의 흰 면은 바탕이 비쳐야 한다."""
from PIL import Image, ImageDraw

from app.services.brand_kit_service import knockout_white
from app.services.business_card import CARD_BACK_BG, derive_card_bg_colors

TEAL = (15, 95, 102)


def _logo(bg=(255, 255, 255)):
    im = Image.new("RGB", (200, 200), bg)
    d = ImageDraw.Draw(im)
    d.ellipse((40, 40, 160, 160), fill=TEAL)
    d.ellipse((80, 80, 120, 120), fill=(255, 255, 255))  # 글자 속처럼 안쪽 흰 면
    return im


def test_back_is_white():
    """연락처를 읽는 면에 옅은 유색이 깔리면 인쇄 사고처럼 보인다."""
    _, back = derive_card_bg_colors(_logo().convert("RGBA"))
    assert back == CARD_BACK_BG == (255, 255, 255)


def test_front_still_derives_from_logo():
    front, _ = derive_card_bg_colors(_logo().convert("RGBA"))
    assert front != (255, 255, 255)


def test_inner_white_becomes_transparent():
    """유색 명함 위에서 흰 안쪽 면이 흰 덩어리로 드러나면 안 된다."""
    out = knockout_white(_logo().convert("RGBA"))
    assert out.getpixel((100, 100))[3] == 0


def test_ink_keeps_full_alpha():
    out = knockout_white(_logo().convert("RGBA"))
    assert out.getpixel((50, 100))[3] == 255


def test_pale_tint_is_preserved():
    """아이보리·연분홍 같은 의미 있는 옅은 면은 살려야 한다."""
    im = Image.new("RGBA", (10, 10), (240, 232, 214, 255))
    assert knockout_white(im).getpixel((5, 5))[3] == 255


def test_already_transparent_stays_transparent():
    im = Image.new("RGBA", (10, 10), (15, 95, 102, 0))
    assert knockout_white(im).getpixel((5, 5))[3] == 0


# --- 브랜드명 중복 / 로고 크기 ------------------------------------------------
# 실측: 로고 이미지가 이미 워드마크를 품고 있는데 명함 앞뒷면에 같은 이름과 모토를
# 또 찍어, 로고 바로 밑에 같은 글자가 반복됐다.
from PIL import ImageChops  # noqa: E402

from app.services.business_card import (  # noqa: E402
    CardLayout,
    compose_card_front,
)

BG = (8, 52, 56)


def _mark():
    im = Image.new("RGBA", (400, 300), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse((20, 20, 380, 280), fill=TEAL + (255,))
    return im


def _ink_bbox(card):
    bg = Image.new("RGB", card.size, BG)
    diff = ImageChops.difference(card.convert("RGB"), bg).convert("L")
    return diff.point(lambda p: 255 if p > 24 else 0).getbbox()


def test_no_brand_name_means_bigger_logo():
    """이름 자리를 로고가 넘겨받으므로 더 크게 앉아야 한다."""
    solo = _ink_bbox(compose_card_front(_mark(), "", "", BG, None, None))
    named = _ink_bbox(compose_card_front(_mark(), "Beyond", "친환경", BG, None, None))
    assert (solo[3] - solo[1]) > (named[3] - named[1])


def test_solo_logo_stays_inside_card():
    card = compose_card_front(_mark(), "", "", BG, None, None)
    x0, y0, x1, y1 = _ink_bbox(card)
    assert x0 >= 0 and y0 >= 0 and x1 <= card.width and y1 <= card.height


def test_solo_logo_is_centered():
    card = compose_card_front(_mark(), "", "", BG, None, None)
    x0, _, x1, _ = _ink_bbox(card)
    assert abs((x0 + x1) / 2 - card.width / 2) <= 2


def test_named_layout_unchanged():
    """한글 브랜드처럼 로고에 이름이 없는 경우는 기존 배치를 지켜야 한다."""
    layout = CardLayout()
    assert layout.logo_box_front == (400, 110, 650, 300)


# --- 뒷면 로고 크기 ----------------------------------------------------------
from app.services.business_card import compose_card_back  # noqa: E402

WHITE_BG = (255, 255, 255)
CONTACT = {"person_name": "남현욱", "title": "대표", "mobile": "010-0000-0000"}


def _back(brand, tagline=""):
    return compose_card_back(_mark(), brand, tagline, CONTACT, WHITE_BG, None, None)


def _logo_bbox_back(card):
    """왼쪽 위 로고 영역만 본다 - 오른쪽 연락처 블록과 섞이지 않게."""
    region = card.convert("RGB").crop((0, 0, 500, 240))
    bg = Image.new("RGB", region.size, WHITE_BG)
    diff = ImageChops.difference(region, bg).convert("L")
    return diff.point(lambda p: 255 if p > 24 else 0).getbbox()


def test_back_logo_is_bigger_without_brand_text():
    solo = _logo_bbox_back(_back(""))
    named = _logo_bbox_back(_back("Beyond", "친환경"))
    assert (solo[3] - solo[1]) > (named[3] - named[1])
    assert (solo[2] - solo[0]) > (named[2] - named[0])


def test_back_logo_does_not_reach_contact_block():
    """연락처 블록은 y=275부터다. 로고가 거기까지 내려오면 안 된다."""
    solo = _logo_bbox_back(_back(""))
    assert solo[3] < 275


def test_back_named_layout_unchanged():
    assert CardLayout().logo_box_back == (60, 55, 175, 155)


# --- 앞면: 브랜드 색 바탕 + 흰 로고(역상) -------------------------------------
# 앞면 배경을 로고 이미지의 대표색에서 유도하면 사용자가 고른 색과 미묘하게 달라져
# 로고와 명함 바탕의 색이 어긋나 보였다. 설문 색을 정본으로 삼는다.
from app.services.brand_kit_service import _card_front_bg, tint_solid  # noqa: E402


def _luma(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def test_front_bg_equals_the_logo_ink():
    """앞면 바탕과 뒷면 로고가 같은 색이어야 한다.

    실측: 색을 두 개 이상 고르면 단색 강제가 걸리지 않아, 로고 잉크와 설문 첫
    색이 서로 다른 파랑이 됐다. 앞면 바탕과 뒷면 로고 색이 미묘하게 어긋났다.
    """
    im = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse((30, 30, 170, 170), fill=TEAL + (255,))
    assert _card_front_bg(im) == TEAL


def test_front_bg_ignores_the_survey():
    """설문 색이 아니라 실제로 칠해진 색을 본다."""
    im = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse((30, 30, 170, 170), fill=TEAL + (255,))
    assert _card_front_bg(im) != (255, 0, 0)


def test_light_logo_is_darkened_for_contrast():
    """밝은 로고를 그대로 깔면 흰 역상 로고가 묻힌다."""
    im = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse((30, 30, 170, 170), fill=(255, 225, 239, 255))
    assert _luma(_card_front_bg(im)) <= 151


def test_tint_solid_makes_logo_white():
    im = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
    ImageDraw.Draw(im).rectangle((2, 2, 7, 7), fill=TEAL + (255,))
    out = tint_solid(im, (255, 255, 255))
    assert out.getpixel((5, 5)) == (255, 255, 255, 255)


def test_tint_solid_preserves_alpha():
    im = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
    ImageDraw.Draw(im).rectangle((2, 2, 7, 7), fill=TEAL + (255,))
    out = tint_solid(im, (255, 255, 255))
    assert out.getpixel((0, 0))[3] == 0
