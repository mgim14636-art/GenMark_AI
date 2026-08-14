# -*- coding: utf-8 -*-
"""brand_kits.kit_type의 DB 허용값을 AI 서버가 전부 받는지 고정한다.

DB CHECK가 계약의 출처다.

    chk_kit_type CHECK (kit_type IN ('BUSINESS_CARD','THUMBNAIL'))   -- V22

백엔드는 이 값을 가공 없이 그대로 보낸다.

    BrandKitProcessor: request.put("kit_type", kit.getKitType().name())
    BrandKit.KitType  : { BUSINESS_CARD, THUMBNAIL }

그래서 두 값 중 하나라도 KitType Literal에 없으면 FastAPI가 422로 끊고
해당 경로의 브랜드킷 생성이 통째로 실패한다. (실제로 THUMBNAIL이 빠져 있어
BI 제품 썸네일이 전량 실패했다.)

DDL의 CHECK를 바꾸면 DB_ALLOWED_KIT_TYPES도 같이 바꿔야 한다.
"""
import pytest

from app.schemas.brand_kit import CANONICAL_KIT_TYPE, KIT_SIZE, BrandKitRequest

# database/migration/V22__rename_kit_type_bottle_to_thumbnail.sql 의 chk_kit_type
DB_ALLOWED_KIT_TYPES = ("BUSINESS_CARD", "THUMBNAIL")

# 백엔드 BrandKitProcessor가 CI/BI에서 각각 보내는 값
BACKEND_SENDS = {"CI": "BUSINESS_CARD", "BI": "THUMBNAIL"}


def _request(kit_type: str, ci_bi: str = "BI") -> BrandKitRequest:
    return BrandKitRequest(
        kit_type=kit_type,
        logo_image_base64="AAAA",
        survey={"brand_name": "AURA"},
        ci_bi=ci_bi,
    )


@pytest.mark.parametrize("kit_type", DB_ALLOWED_KIT_TYPES)
def test_db_allowed_kit_type_is_accepted(kit_type):
    """DB에 저장 가능한 값은 전부 요청으로 받아들여져야 한다."""
    assert _request(kit_type).kit_type == kit_type


@pytest.mark.parametrize("ci_bi,kit_type", sorted(BACKEND_SENDS.items()))
def test_backend_payload_is_accepted(ci_bi, kit_type):
    """백엔드가 실제로 보내는 조합이 그대로 통과해야 한다."""
    req = _request(kit_type, ci_bi=ci_bi)
    assert req.canonical_kit_type in KIT_SIZE


@pytest.mark.parametrize("kit_type", DB_ALLOWED_KIT_TYPES)
def test_db_allowed_kit_type_resolves_to_known_size(kit_type):
    """정규화 결과가 산출물 규격 표에 있어야 렌더러가 크기를 정할 수 있다."""
    canonical = CANONICAL_KIT_TYPE[kit_type]
    assert canonical in KIT_SIZE, f"{kit_type} -> {canonical} 의 규격이 정의돼 있지 않다."


def test_thumbnail_aliases_agree():
    """THUMBNAIL·PRODUCT_THUMBNAIL·BOTTLE은 같은 산출물이어야 한다."""
    canonical = {CANONICAL_KIT_TYPE[k] for k in ("THUMBNAIL", "PRODUCT_THUMBNAIL", "BOTTLE")}
    assert canonical == {"PRODUCT_THUMBNAIL"}


def test_unknown_kit_type_is_rejected():
    """규격 밖 값은 계속 거절해야 한다 (별칭 추가로 검증이 느슨해지지 않았는지)."""
    with pytest.raises(Exception):
        _request("POSTER")
