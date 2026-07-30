from pydantic import BaseModel
from typing import List, Optional

class SimilarityRequest(BaseModel):
    image_url: str
    top_k: int = 5

class MatchedTrademark(BaseModel):
    trademark_id: str
    trademark_name: Optional[str] = None
    similarity_score: float

class SimilarityResponse(BaseModel):
    image_url: str
    matches: List[MatchedTrademark]
