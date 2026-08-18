# -*- coding: utf-8 -*-
"""사전 폴백이 사용자의 형태 요청을 통째로 버리지 않는지 고정한다.

실측: "물방울과 꽃잎 모양을 조화롭게 만들어주세요" -> "잎사귀". 목록을 위에서
훑다가 "꽃잎" 속의 "잎"이 먼저 걸려 거기서 확정됐고, 물방울도 꽃도 조합 요청도
전부 사라졌다. 결과 화면에는 잎사귀 하나만 나왔다.
"""
import pytest

from app.services.motif_translation_service import _local_fallback

PETAL = "a single stylised flower petal"
DROPLET = "a clean water-droplet symbol"
LEAF = "a refined botanical leaf silhouette"


def test_compound_word_is_not_hijacked_by_its_substring():
    """"꽃잎"이 "잎"으로 읽히면 안 된다."""
    out = _local_fallback("꽃잎 모양")
    assert PETAL in out
    assert LEAF not in out


def test_two_motifs_are_both_kept():
    out = _local_fallback("물방울과 꽃잎 모양을 조화롭게 만들어주세요")
    assert PETAL in out and DROPLET in out


def test_single_motif_has_no_connector():
    assert _local_fallback("달 모양") == "an elegant crescent-moon emblem"


def test_plain_leaf_still_maps_to_leaf():
    assert _local_fallback("나뭇잎 하나") == LEAF


def test_many_motifs_are_capped():
    """다 넣으면 프롬프트가 산만해진다. 앞의 몇 개만 쓴다."""
    out = _local_fallback("별과 달과 산과 나무와 꽃과 물방울")
    assert out.count("combined with") <= 2


@pytest.mark.parametrize("text", ["아무거나", "", "그냥 예쁘게"])
def test_unknown_text_returns_none(text):
    """사전이 못 알아들으면 None - 호출부가 LLM 결과나 자리표시자로 넘어간다."""
    assert _local_fallback(text) is None


def test_llm_is_tried_before_the_dictionary():
    """사전이 먼저 걸리면 문장 전체를 읽는 번역 기회가 사라진다."""
    import inspect

    from app.services import motif_translation_service as m

    src = inspect.getsource(m.enrich_logo_shape)
    assert "_call_openrouter(shape) or _local_fallback(shape)" in src
