from pydantic import BaseModel, Field


class CardSampleRequest(BaseModel):
    brand_name: str = Field(..., description="브랜드명")
    tagline: str = Field("", description="태그라인, 예: since 2024")
    title: str = Field("", description="직함, 예: 대표")
    person_name: str = Field("", description="이름")
    mobile: str = Field("", description="전화번호")
    email: str = Field("", description="이메일")
    address: str = Field("", description="주소")
    bg_front: str = Field("27,42,78", description="앞면 배경색 R,G,B")
    bg_back: str = Field("250,235,241", description="뒷면 배경색 R,G,B")


class CardSampleResponse(BaseModel):
    front_image_base64: str
    back_image_base64: str
