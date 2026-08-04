# FastAPI AI Server API Documentation

## Endpoints

- `GET /health` - Health check status
- `POST /api/v1/generation/generate` - Generate logo from text prompt via FLUX model
- `POST /api/v1/embedding/extract` - Extract feature vector via DINOv2
- `POST /api/v1/similarity/search` - Search top-K similar trademark vectors in FAISS





## 상표 유사도 분석 (POST /api/v1/similarity/search)

담당: 남현욱 · 기준 문서: GenMark AI Backend API Specification v1.0 (11장)

### 요청

```json
{
  "imageBase64": "...",
  "logoStyle": "combination",
  "topK": 3
}
```

### 응답

```json
{
  "maxSimilarity": 27,
  "riskLevel": "SAFE",
  "matches": [
    {
      "rank": 1,
      "applicationNumber": "4020200003334",
      "name": "OLIVE YOUNG AWARDS",
      "category": "화장품 · 도형복합",
      "similarity": 27,
      "imagePath": "raw/cosmetic/.../4020200003334_tm000001.jpg"
    }
  ],
  "disclaimer": "본 분석은 로고 이미지의 시각적 유사성을 보여주는 참고 자료이며, 상표 등록 가능 여부나 법적 침해 여부를 판단하지 않습니다."
}
```

`riskLabel`, `riskDescription`은 백엔드에서 매핑하는 것을 제안합니다. 문구 변경 시 AI 서버 재배포가 불필요하기 때문입니다.

## 상표 데이터

| 항목 | 내용 |
|---|---|
| 출처 | KIPRIS Plus 벌크 데이터(선택형) / 한국특허정보원 |
| 범위 | 상품분류 3류(화장품), 유형 도형상표·도형복합, 행정상태 등록 |
| 현재 규모 | 670건 (이미지 100% 확보, 비엔나 분류코드 668건) |
| 포함 정보 | 출원번호, 출원·등록일자, 상표명, 비엔나 분류코드, 유사군 코드, 법적상태, 상표견본 이미지 |
| 갱신 주기 | 수동 재신청. 프로젝트 기간 중 갱신 없음 |
| 한계 | 3류 도형상표 표본이며 전체 상표 DB가 아님. 결과 화면에 참고용임을 명시 필요 |

## 유사도 점수 산정

명세 11.4의 3구간(0~29 안전 / 30~59 보통 / 60~100 주의)은 그대로 유지합니다.

단, 응답의 `similarity`는 모델의 원시 코사인 유사도가 아니라 **실측 분포 기반 백분위 점수**입니다.

보유 상표 670건의 전체 쌍(224,115건) 측정 결과:

| 지표 | 코사인 유사도 |
|---|---|
| 평균 | 0.493 |
| 상위 50% | 0.508 |
| 상위 10% | 0.678 |
| 상위 5% | 0.722 |
| 상위 1% | 0.803 |

DINOv2의 코사인 유사도는 서로 무관한 상표 간에도 평균 0.49가 나옵니다. 이 값을 그대로 백분율로 환산하면 무관한 상표의 약 25%가 "주의" 등급으로 분류됩니다. 따라서 원시 유사도를 위 분포상의 백분위로 변환해 0~100 정수로 반환합니다.

## 협의 필요 항목

### matches[].note

명세 예시("원형 배지와 잎사귀 형태가 일부 유사해요")와 같은 자연어 설명은 이미지 임베딩만으로 생성되지 않습니다.

1. 비엔나 분류코드 교집합 기반 템플릿 문구 — 구현 가능, 근거 명확 **(권장)**
2. LLM 기반 설명 생성 — 자연스러우나 응답 시간·비용 증가
3. 필드 제외

### matches[].imageUrl

상표 이미지 서빙 방식 결정 필요 (인프라 협의). AI 서버는 상대 경로만 반환합니다.