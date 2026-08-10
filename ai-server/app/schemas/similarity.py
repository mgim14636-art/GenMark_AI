from typing import List, Literal

from pydantic import BaseModel, Field


class SimilarityRequest(BaseModel):
    """백엔드 계약 §11. 필드명은 camelCase.

    imageBase64는 `data:image/png;base64,` 접두사 없는 순수 Base64 문자열.
    """

    imageBase64: str = Field(min_length=1)
    logoStyle: Literal["combination"] = "combination"
    topK: int = Field(default=3, ge=1, le=20)


class MatchedTrademark(BaseModel):
    rank: int = Field(ge=1)
    applicationNumber: str = Field(min_length=1)
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    similarity: int = Field(ge=0, le=100)
    imagePath: str = Field(min_length=1)


class SimilarityResponse(BaseModel):
    maxSimilarity: int = Field(ge=0, le=100)
    riskLevel: Literal["SAFE", "MODERATE", "CAUTION"]
    matches: List[MatchedTrademark]
    disclaimer: str = Field(min_length=1)
