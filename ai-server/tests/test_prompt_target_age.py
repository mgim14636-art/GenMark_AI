# -*- coding: utf-8 -*-
"""bi_project.target_age의 DB 허용값이 전부 프롬프트에 반영되는지 고정한다.

DB CHECK가 규격의 출처다.

    chk_bi_target_age CHECK (target_age IN ('10~20','30~40','50~60','전 연령층'))

BiProject.toSurvey()가 이 값을 가공 없이 그대로 넘기므로, 여기 네 값이
_CURRENT_SURVEY_ALIASES -> TARGET_AGE_MODIFIER 경로를 통과하지 못하면
타겟 연령 문구가 조용히 사라진다. (실제로 물결표 표기 3개가 그랬다.)

DDL의 CHECK를 바꾸면 DB_ALLOWED_TARGET_AGES도 같이 바꿔야 한다.
"""
import pytest

from app.services.prompt_service import (
    TARGET_AGE_MODIFIER,
    _CURRENT_SURVEY_ALIASES,
    _normalize_survey,
)

# database/migration/V23__allow_null_ci_bi_primary_colors.sql 의 chk_bi_target_age
DB_ALLOWED_TARGET_AGES = ("10~20", "30~40", "50~60", "전 연령층")


def _phrase_for(target_age: str) -> str:
    """설문 정규화를 거친 뒤 실제로 프롬프트에 붙는 연령 문구."""
    survey = _normalize_survey({"ci_bi": "BI", "target_age": target_age})
    return TARGET_AGE_MODIFIER.get(survey.get("target_age", ""), "")


@pytest.mark.parametrize("target_age", DB_ALLOWED_TARGET_AGES)
def test_every_db_allowed_target_age_produces_a_phrase(target_age):
    phrase = _phrase_for(target_age)
    assert phrase, (
        f"target_age={target_age!r} 가 프롬프트 문구로 이어지지 않는다. "
        f"_CURRENT_SURVEY_ALIASES['target_age'] 에 키를 추가할 것."
    )


def test_db_allowed_values_map_to_distinct_phrases():
    """네 구간이 서로 다른 문구여야 연령대 구분이 프롬프트에 실린다."""
    phrases = [_phrase_for(v) for v in DB_ALLOWED_TARGET_AGES]
    assert len(set(phrases)) == len(phrases), f"중복된 연령 문구: {phrases}"


def test_alias_table_covers_db_check_exactly():
    """DB CHECK 값이 별칭 표에 모두 있는지 (누락 조기 발견용)."""
    alias_keys = set(_CURRENT_SURVEY_ALIASES["target_age"])
    missing = [v for v in DB_ALLOWED_TARGET_AGES if v not in alias_keys]
    assert not missing, f"별칭 표에 없는 DB 허용값: {missing}"


def test_unknown_target_age_is_dropped_not_crashed():
    """규격 밖 값이 들어와도 예외 없이 조용히 빠지기만 해야 한다."""
    assert _phrase_for("99~100") == ""
    assert _phrase_for("") == ""
