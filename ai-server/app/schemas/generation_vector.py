from typing import Optional

from pydantic import BaseModel


class RegisterRequest(BaseModel):
    image_url: str
    id: str


class RegisterResponse(BaseModel):
    id: str
    totalCount: int


class CompareByIdRequest(BaseModel):
    id: str
    image_url: str
    # 등록된 벡터 자체의 원본 이미지. 점수 계산에는 안 쓰이고(점수는 저장된 벡터로
    # 계산한다), 두 이미지가 왜 닮았는지 설명하는 note를 만들 때만 쓴다.
    vector_image_url: Optional[str] = None


class CompareByIdResponse(BaseModel):
    similarity: int
    riskLevel: str
    disclaimer: str
    note: Optional[str] = None
