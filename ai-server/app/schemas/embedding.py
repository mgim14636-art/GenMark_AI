from pydantic import BaseModel
from typing import List

class EmbeddingRequest(BaseModel):
    image_url: str

class EmbeddingResponse(BaseModel):
    dimension: int
    vector: List[float]
