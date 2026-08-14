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
    brand_description: Optional[str] = Field(None, description="브랜드 가치 설명 서술형(BI)")

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

    # 상한이 없으면 한 번의 요청으로 수백 장이 생성돼 크레딧이 소진된다
    # (docs/2026-08-11_로고생성_문제점-점검.md 2번). max_workers도 같이 묶인다.
    num_variants: int = Field(1, ge=1, le=1, description="생성할 로고 시안 수 (현재 1개 고정)")

    variant_offset: int = Field(
        0,
        ge=0,
        le=64,
        description=(
            "재생성(F12-2)용 모티프 시작 위치. 최초 생성은 0, 재생성 N회차는 N*num_variants. "
            "prompt_service가 variant_index로 모티프를 순환 배정하므로 offset을 주면 "
            "직전 회차와 다른 형태의 시안이 나온다."
        ),
    )

    def to_survey_dict(self) -> dict:
        """prompt_service/logo_composer가 기대하는 plain dict로 변환한다.

        (num_variants·variant_offset은 라우트에서 생성 개수와 모티프 위치를 제어하는
        용도이고 프롬프트 문구 조립에는 관여하지 않으므로 제외한다. None 필드도
        제외해 "설문에 없는 항목"과 "빈 값"을 구분한다.)
        """
        return self.model_dump(
            exclude_none=True, exclude={"num_variants", "variant_offset"}
        )


class GeneratedLogo(BaseModel):
    imageBase64: str

    # 백엔드 logo_candidates.ai_metadata_json에 저장해 재생성 품질 추적에 쓰는 값들.
    # 응답 본문에 추가만 된 것이라 기존 소비자는 영향받지 않는다.
    seed: Optional[int] = None
    variantIndex: Optional[int] = None

    # 벡터 모델(recraft-*-vector)일 때만 채워진다. 배경 path를 제거한 투명 배경
    # 원본으로, 프론트의 SVG 다운로드와 색 치환 편집이 이 값을 쓴다.
    # imageBase64는 이 SVG를 래스터화해 브랜드명까지 합성한 최종본이라 서로 다르다.
    svg: Optional[str] = None


class GenerationResponse(BaseModel):
    logos: List[GeneratedLogo]
