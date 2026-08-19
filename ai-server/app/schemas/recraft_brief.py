from typing import List, Optional

from pydantic import BaseModel, Field


class BriefRequest(BaseModel):
    """app/schemas/generation.py(GenerationRequest)와 같은 설문 필드를 쓴다 —
    그대로 재사용해서, 이 엔드포인트를 위한 별도 입력 폼이 필요 없게 했다.
    """

    brand_name: Optional[str] = None
    company_name: Optional[str] = None
    ci_bi: Optional[str] = None
    industry: Optional[str] = None
    tone: Optional[str] = None
    color_mode: str = "ai"
    color_manual: Optional[List[str]] = None
    brand_values: Optional[List[str]] = None
    motif_category: Optional[List[str]] = None
    generate_image: bool = Field(False, description="true면 Recraft로 실제 이미지까지 생성")


class BriefResponse(BaseModel):
    prompt: str
    image_base64: Optional[str] = None
