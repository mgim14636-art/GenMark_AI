from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class SimilarityRequest(BaseModel):
    """백엔드 계약 §11. 필드명은 camelCase.

    imageBase64는 `data:image/png;base64,` 접두사 없는 순수 Base64 문자열.
    """

    imageBase64: str = Field(min_length=1)

    # 도형을 포함한 스타일만 허용한다.
    #
    # 기준 DB가 3류 '도형복합'(도형+문자) 등록상표뿐이라, 도형이 없는 로고를 넣으면
    # 형태가 아니라 "흰 여백이 넓고 작은 글자가 있다"는 레이아웃이 유사도를 지배한다.
    # 실측(scripts/calibrate_score.py, n=10/스타일)에서 top-1 코사인 중앙값이
    #   워드마크 0.94, 레터마크 0.93  vs  혼합형 0.67, 심볼 0.59
    # 로 갈렸다. 등록 상표 간 최근접 중앙값(0.89)보다도 높아 오탐이 확실하다.
    # 문자 전용 스타일은 도형 유사도로 판정할 수 없으므로 422로 거절한다.
    logoStyle: Literal["combination", "symbol"] = "combination"
    topK: int = Field(default=3, ge=1, le=20)


class MatchedTrademark(BaseModel):
    rank: int = Field(ge=1)
    applicationNumber: str = Field(min_length=1)
    name: str = Field(min_length=1)
    category: str = Field(min_length=1)
    similarity: int = Field(ge=0, le=100)
    imagePath: str = Field(min_length=1)

    # KIPRIS 등록 상표 매치인지, 관리자가 수동 등록해둔 자체 생성 로고 매치인지.
    # 기본값 KIPRIS로 두어 이 필드를 모르는 옛 소비자와도 호환된다.
    source: Literal["KIPRIS", "GENERATED"] = "KIPRIS"

    # 왜 닮았는지에 대한 한 줄 설명(Gemini). 부가 정보이므로 없을 수 있다.
    # 외부 API 실패·지연·콘텐츠 필터링 시 생략되며, 그래도 응답은 정상이다.
    # 소비 측은 note가 없을 수 있음을 전제해야 한다.
    note: Optional[str] = None


class SimilarityResponse(BaseModel):
    maxSimilarity: int = Field(ge=0, le=100)
    riskLevel: Literal["SAFE", "MODERATE", "CAUTION"]
    matches: List[MatchedTrademark]
    disclaimer: str = Field(min_length=1)
