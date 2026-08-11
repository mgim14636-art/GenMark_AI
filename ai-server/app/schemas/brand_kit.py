"""브랜드킷(F14) 요청·응답 스키마.

백엔드 요청서(2026-08-11 「AI 서버 작업 요청서」 3-2)가 제안한 필드명을 그대로
받는다. 기존 /generate가 snake_case 설문 필드를 쓰고 있어 요청 본문은 snake_case로
통일하고, 응답은 /generate의 logos[].imageBase64와 맞춰 camelCase로 내보낸다.
"""
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

# BOTTLE은 백엔드 요청서의 최초 표기. 기획서 (7) 수행방법의 산출물 정의는
# "스마트스토어 규격(1000x1000) 제품 썸네일"이므로 PRODUCT_THUMBNAIL을 정식
# 명칭으로 두고, BOTTLE은 같은 산출물의 별칭으로 계속 허용한다(백엔드 무중단 전환용).
KitType = Literal["BUSINESS_CARD", "PRODUCT_THUMBNAIL", "BOTTLE"]

CANONICAL_KIT_TYPE = {
    "BUSINESS_CARD": "BUSINESS_CARD",
    "PRODUCT_THUMBNAIL": "PRODUCT_THUMBNAIL",
    "BOTTLE": "PRODUCT_THUMBNAIL",
}

# 산출물 규격 — 명함은 국내 표준 90x50mm를 300dpi로, 썸네일은 기획서 명시값.
KIT_SIZE = {
    "BUSINESS_CARD": (1063, 591),
    "PRODUCT_THUMBNAIL": (1000, 1000),
}


class CardInfo(BaseModel):
    """명함에 인쇄될 사용자 정보.

    기획서 (5) 개발 내용의 'CI 브랜드킷: ... 사용자 정보(이름·직함·연락처)를 합성'에
    해당한다. 백엔드 요청서 3-2 예시에는 이 항목이 빠져 있어 신규로 정의한다.
    이름 외에는 비어 있어도 되며, 빈 항목은 레이아웃에서 통째로 생략된다.
    """

    name: str = Field(..., min_length=1, max_length=40)
    title: Optional[str] = Field(None, max_length=40, description="직함")
    company: Optional[str] = Field(None, max_length=60)
    phone: Optional[str] = Field(None, max_length=40)
    email: Optional[str] = Field(None, max_length=80)
    address: Optional[str] = Field(None, max_length=120)


class BrandKitRequest(BaseModel):
    kit_type: KitType
    logo_image_base64: str = Field(..., description="완성 로고 PNG의 Base64 (data URI 접두어 허용)")
    ci_bi: Optional[str] = Field(None, description="'CI' 또는 'BI'")

    # 로고 생성 때 넘긴 것과 같은 설문 구조. 색상·톤만 참조하므로 스키마를 고정하지
    # 않고 dict로 받는다 — 백엔드가 필드를 늘려도 AI 서버 배포 없이 흡수된다.
    survey: Dict[str, Any] = Field(default_factory=dict)

    card_info: Optional[CardInfo] = Field(None, description="kit_type=BUSINESS_CARD일 때 필수")
    product_name: Optional[str] = Field(None, max_length=60, description="썸네일 하단 문구(생략 가능)")

    @property
    def canonical_kit_type(self) -> str:
        return CANONICAL_KIT_TYPE[self.kit_type]


class BrandKitImage(BaseModel):
    imageBase64: str
    width: int
    height: int


class BrandKitResponse(BaseModel):
    kitType: str
    images: List[BrandKitImage]
    preliminary: bool = Field(
        False,
        description="True면 최종 산출 품질이 아닌 임시 합성 결과. 연동 테스트용.",
    )
    elapsedMs: int = 0
