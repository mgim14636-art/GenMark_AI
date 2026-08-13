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

# 산출물 규격.
#
# 명함 규격은 렌더러(business_card.CardLayout)를 단일 기준으로 삼는다. 여기에
# 숫자를 따로 적어두면 레이아웃을 조정할 때 두 곳이 조용히 어긋난다.
#
# 참고: 국내 표준 명함은 90x50mm이고 300dpi로 환산하면 1063x591이다. 현재
# 레이아웃(1050x600)은 그보다 조금 다르므로, 인쇄 입고를 전제한다면 규격을
# 맞추는 편이 안전하다 — 담당자와 확인이 필요한 항목.
def _card_size() -> tuple:
    from app.services.business_card import CardLayout

    layout = CardLayout()
    return (layout.width, layout.height)


KIT_SIZE = {
    "BUSINESS_CARD": _card_size(),
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

    # 백엔드 BrandKitProcessor.buildRequest는 현재 kit_type/logo_image_base64/survey/ci_bi
    # 네 가지만 보낸다. 필수로 잡으면 CI 브랜드킷이 전부 FAILED로 끝나므로 선택 항목으로
    # 두고, 없으면 회사명만 넣은 브랜드 카드로 합성한 뒤 preliminary=True로 표시한다.
    card_info: Optional[CardInfo] = Field(None, description="명함에 인쇄할 사용자 정보")
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

    # 백엔드 FastApiBrandKitAiClient가 응답 최상위의 imageBase64를 읽는다.
    # images[]는 앞/뒤면·각도 변형을 대비한 정식 필드이고, imageBase64는 그 첫 장을
    # 그대로 복제해 백엔드 수정 없이 붙을 수 있게 둔 호환 필드다.
    imageBase64: str
    images: List[BrandKitImage]

    preliminary: bool = Field(
        False,
        description="True면 최종 산출 품질이 아닌 임시 합성 결과. 연동 테스트용.",
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="preliminary인 이유. 백엔드가 error_message 대신 로깅용으로 쓸 수 있다.",
    )
    elapsedMs: int = 0
