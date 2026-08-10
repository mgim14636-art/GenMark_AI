from typing import List, Optional

from pydantic import BaseModel, Field


class GenerationRequest(BaseModel):
    """로고 생성 설문 요청 스키마.

    logo_ai_server(Flask 프로토타입)의 prompt_builder.py가 원래 느슨한 dict로 받던
    필드들을 그대로 옮겨왔다. CI/BI 두 화면의 필드명(예: 브랜드명은 BI가 brand_name,
    CI가 company_name)을 둘 다 받을 수 있고, prompt_service._normalize_survey가
    ci_bi 값을 보고 공통 필드로 맞춰준다. 대부분 Optional인 이유도 동일 — 화면마다
    채워지는 필드 구성이 다르다.
    """

    ci_bi: Optional[str] = Field(None, description="'CI' 또는 'BI' — 설문 화면 구분")

    # 브랜드명 (BI 화면: brand_name, CI 화면: company_name)
    brand_name: Optional[str] = None
    company_name: Optional[str] = None
    brand_direction: Optional[str] = Field(None, description="브랜드 방향성/핵심 편익 서술형(BI)")

    # 기업 가치·방향성 (BI: brand_values/brand_values_text, CI: company_values/company_values_text)
    brand_values: Optional[List[str]] = None
    brand_values_text: Optional[str] = None
    company_values: Optional[List[str]] = None
    company_values_text: Optional[str] = None

    style: str = Field("심볼", description="심볼 | 워드마크 | 혼합형 | 레터마크")
    industry: Optional[str] = Field(None, description="현재 '뷰티'만 지원(MVP)")
    tone: Optional[str] = None
    target_age: Optional[str] = None

    color_mode: str = Field("ai", description="'ai'(톤 기반 자동 추천) 또는 'manual'")
    color_manual: Optional[List[str]] = None

    motif_category: Optional[List[str]] = Field(None, description="모티프 카테고리 칩(복수 선택 가능)")
    concreteness: Optional[str] = Field(None, description="완전 추상 | 적당히 단순화 | 사실적")
    additional_requirements: Optional[str] = None

    text_color: Optional[str] = Field(None, description="혼합형/워드마크/레터마크 텍스트 색상 직접 지정")
    include_brand_name_in_logo: Optional[bool] = None

    num_variants: int = Field(4, ge=1, description="생성할 로고 시안 수")

    def to_survey_dict(self) -> dict:
        """prompt_service/logo_composer가 기대하는 plain dict로 변환한다.

        (num_variants는 라우트에서 개수 제어용으로만 쓰고 프롬프트 조립에는
        관여하지 않으므로 제외한다. None 필드도 제외해 "설문에 없는 항목"과
        "빈 값"을 구분한다.)
        """
        return self.model_dump(exclude_none=True, exclude={"num_variants"})


class GeneratedLogo(BaseModel):
    imageBase64: str


class GenerationResponse(BaseModel):
    logos: List[GeneratedLogo]
