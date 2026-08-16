# -*- coding: utf-8 -*-
"""로고 마감(면 solid / 선 outline) 지시가 프롬프트에 정확히 반영되는지 고정한다.

Recraft는 OpenRouter 경유라 style 파라미터를 실을 수 없어 프롬프트로만 제어한다.
그래서 면을 전제하는 어휘(silhouette 등)가 하나라도 남으면 선 지시가 무력해진다.
"""
import pytest

from app.services.prompt_service import (
    DEFAULT_LOGO_FINISH,
    LOGO_FINISH_OUTLINE,
    LOGO_FINISH_SOLID,
    _resolve_finish,
    _strip_fill_words,
    build_prompt_from_survey,
)

BASE = {
    "ci_bi": "CI",
    "company_name": "Hyeonwook",
    "industry": "COSMETICS",
    "tone": "professional",
    "style": "combination",
    "color_mode": "MANUAL",
    "color_manual": ["#17185b"],
}


def _prompt(**extra):
    return build_prompt_from_survey({**BASE, **extra}, variant_index=0)


def test_default_is_unchanged_solid():
    """기본값을 바꾸면 기존 사용자의 결과가 통째로 달라진다. solid를 유지한다."""
    assert DEFAULT_LOGO_FINISH == LOGO_FINISH_SOLID
    prompt = _prompt()
    assert "Use a strong silhouette" in prompt
    assert "line art" not in prompt


def test_outline_switches_to_line_art():
    prompt = _prompt(logo_finish="outline")
    assert "clean line art" in prompt
    assert "never filled in" in prompt
    assert "Use a strong silhouette" not in prompt


def test_outline_removes_fill_words_from_motif():
    """모티프에 남은 'silhouette'이 선 지시와 충돌하지 않아야 한다."""
    prompt = _prompt(logo_finish="outline")
    assert "silhouette" not in prompt, "면을 전제하는 어휘가 남아 있다"


def test_outline_single_color_says_stroke():
    prompt = _prompt(logo_finish="outline")
    assert "single stroke color" in prompt
    assert "single flat color" not in prompt


def test_solid_single_color_says_flat():
    prompt = _prompt(logo_finish="solid")
    assert "single flat color" in prompt


@pytest.mark.parametrize(
    "value,expected",
    [
        ("outline", LOGO_FINISH_OUTLINE),
        ("line", LOGO_FINISH_OUTLINE),
        ("line_art", LOGO_FINISH_OUTLINE),
        ("선", LOGO_FINISH_OUTLINE),
        ("선형", LOGO_FINISH_OUTLINE),
        ("solid", LOGO_FINISH_SOLID),
        ("면", LOGO_FINISH_SOLID),
        ("", LOGO_FINISH_SOLID),
        ("알수없는값", LOGO_FINISH_SOLID),
    ],
)
def test_finish_aliases(value, expected):
    assert _resolve_finish({"logo_finish": value}) == expected


def test_strip_fill_words():
    assert _strip_fill_words("a single botanical leaf silhouette") == "a single botanical leaf"
    assert _strip_fill_words("an abstract hexagonal emblem") == "an abstract hexagonal"
    # 뗄 게 없으면 원문 유지
    assert _strip_fill_words("a water droplet shape") == "a water droplet shape"
    # 통째로 사라지는 경우는 원문을 지킨다
    assert _strip_fill_words("silhouette") == "silhouette"
