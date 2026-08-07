from typing import List

from pydantic import BaseModel


class SimilarityRequest(BaseModel):
    imageBase64: str
    logoStyle: str = "combination"
    topK: int = 3


class MatchedTrademark(BaseModel):
    rank: int
    applicationNumber: str
    name: str
    category: str
    similarity: int
    imagePath: str


class SimilarityResponse(BaseModel):
    maxSimilarity: int
    riskLevel: str
    matches: List[MatchedTrademark]
    disclaimer: str