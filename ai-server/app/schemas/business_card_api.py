from typing import Optional

from pydantic import BaseModel, Field


class BusinessCardRequest(BaseModel):
    """백엔드가 사용자 입력을 그대로 담아 넘기는 명함 구성 요청.

    logo_image_base64는 generation API(로고 생성)로 이미 만들어진 결과물이다.
    이 API는 로고를 생성하지 않는다 — generation API(로고 생성)와 이 API
    (명함 조립)는 서로 다른 단계다.
    """

    logo_image_base64: str = Field(..., description="완성된 로고 이미지 (PNG, base64)")
    brand_name: str = Field(..., description="브랜드명")
    tagline: str = Field("", description="태그라인, 예: since 2024")
    title: str = Field("", description="직함, 예: 대표")
    person_name: str = Field("", description="이름")
    phone: str = Field("", description="전화번호")
    email: str = Field("", description="이메일")
    address: str = Field("", description="주소")
    bg_front: str = Field("27,42,78", description="앞면 배경색 R,G,B")
    bg_back: str = Field("255,255,255", description="뒷면 배경색 R,G,B")
    font_style: Optional[str] = Field(
        None, description="modern_sans 또는 elegant_serif. 비우면 modern_sans 기본값"
    )
    include_showcase: bool = Field(False, description="true면 기울여 겹친 쇼케이스 이미지도 같이 생성")


class BusinessCardResponse(BaseModel):
    front_image_base64: str
    back_image_base64: str
    showcase_image_base64: Optional[str] = None
