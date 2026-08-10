# GenMark AI 상표 유사도 검색 — AI 팀 요구사항 정의서

## 1. 문서 목적

선택한 로고 이미지와 기존 등록 상표 이미지를 비교하여 가장 비슷한 상표 3건을 반환하는 AI 서비스를 완성한다.

AI 팀은 **상표 데이터 준비, DINOv2 임베딩 생성, FAISS 검색, 점수 계산, 유사도 API 응답**까지 담당한다.

백엔드는 AI API 호출, 사용자 소유권 확인, 분석 결과 DB 저장, 프론트 전달을 담당한다.

## 2. 현재 확인된 문제

1. `ai-server/data/` 아래에 실제 데이터가 없고 `.gitkeep`만 존재한다.
2. 검색에 필요한 `embeddings.npy`와 `trademarks.csv`가 없다.
3. Docker 환경변수에는 `trademark.index`, `metadata.json`이 설정되어 있지만 현재 실행 코드는 해당 값을 사용하지 않는다.
4. 현재 실행 코드는 다음 경로를 하드코딩해서 사용한다.
   - `data/faiss/embeddings.npy`
   - `data/trademarks/meta/trademarks.csv`
5. `ai-server/tests/test_similarity.py`가 실제 camelCase API 계약과 다른 snake_case 요청을 사용한다.
6. 데이터가 없을 때 `/health`가 정상으로 표시될 수 있어 실제 검색 가능 상태를 구분할 수 없다.

## 3. 필수 결과물

AI 팀은 다음 결과물을 전달한다.

```text
ai-server/
├─ data/
│  ├─ trademarks/
│  │  ├─ raw/
│  │  │  ├─ TXT/                       # KIPRIS 원본 텍스트
│  │  │  └─ IMG/                       # KIPRIS 원본 상표 이미지
│  │  └─ meta/
│  │     └─ trademarks.csv             # 검색용 정제 메타데이터
│  ├─ faiss/
│  │  ├─ embeddings.npy                # DINOv2 이미지 벡터
│  │  ├─ ids.csv                       # 벡터 순서와 출원번호 매핑
│  │  └─ data_manifest.json            # 데이터 버전·건수·체크섬
│  └─ outputs/
├─ scripts/
│  ├─ preprocess.py                    # 원본 데이터 정제
│  └─ build_index.py                   # 임베딩 생성
└─ tests/
   └─ test_similarity.py               # 실제 API 계약 테스트
```

대용량 원본 데이터와 생성 파일은 Git에 직접 올리지 않는다. 팀 공유 스토리지 또는 배포 스토리지에 업로드하고 다운로드 위치와 체크섬을 전달한다.

## 4. 상표 메타데이터 형식

파일 위치:

```text
ai-server/data/trademarks/meta/trademarks.csv
```

인코딩:

```text
UTF-8 또는 UTF-8-SIG
```

최종 CSV는 최소한 다음 정보를 포함해야 한다. 한글 원본 컬럼명을 그대로 사용할 경우 AI 코드 안에서 아래 영문 필드로 명확히 매핑한다.

| 표준 필드 | 필수 | 설명 |
|---|---:|---|
| `application_number` | O | 상표 출원번호. 문자열로 저장한다. |
| `name_ko` | △ | 상표 한글명 |
| `name_en` | △ | 상표 영문명 |
| `trademark_type` | O | 상표 구분. 이번 검색 대상은 결합형 상표이다. |
| `class_codes` | O | 상품류 코드. 여러 값이면 `|`로 구분한다. |
| `similar_group_codes` | △ | 유사군 코드. 여러 값이면 `|`로 구분한다. |
| `image_path` | O | `data/trademarks/` 기준 이미지 상대경로 |

규칙:

- `name_ko`와 `name_en` 중 하나 이상은 값이 있어야 한다.
- `application_number`는 중복될 수 없다.
- `image_path`는 실제 파일이 존재해야 한다.
- Windows 절대경로와 컨테이너 절대경로를 저장하지 않는다.
- 경로 구분자는 `/`를 사용한다.
- 이미지가 없거나 열리지 않는 행은 최종 CSV에서 제외한다.
- CSV 행 순서를 임베딩 생성 후 임의로 변경하지 않는다.

예시:

```csv
application_number,name_ko,name_en,trademark_type,class_codes,similar_group_codes,image_path
4020220126402,젠마크,GENMARK,COMBINATION,03,G1201,raw/IMG/4020220126402_tm000001.jpg
```

## 5. 이미지 파일 요구사항

- 지원 형식: PNG, JPEG
- 손상된 파일은 제외한다.
- 투명 배경은 흰색 배경과 합성한 뒤 임베딩한다.
- 모델 입력 시 RGB로 변환한다.
- EXIF 회전 정보를 적용한다.
- 지나치게 작은 이미지와 완전히 빈 이미지는 제외한다.
- 중복 또는 사실상 동일한 이미지는 제거하거나 중복 정보를 표시한다.

## 6. DINOv2 임베딩 요구사항

파일 위치:

```text
ai-server/data/faiss/embeddings.npy
```

필수 형식:

| 항목 | 요구값 |
|---|---|
| 모델 | `facebook/dinov2-base` |
| 벡터 차원 | `768` |
| NumPy dtype | `float32` |
| 배열 shape | `(상표 건수, 768)` |
| 정규화 | 행별 L2 정규화 |
| 비정상 값 | NaN, Infinity 허용 안 함 |

가장 중요한 규칙:

```text
trademarks.csv N번째 행
= embeddings.npy N번째 벡터
= ids.csv N번째 출원번호
```

세 파일의 건수가 반드시 같아야 한다.

현재 목표 데이터 수는 7,423건이며, 실제 최종 건수가 달라지면 제외 사유와 최종 건수를 문서에 기록한다.

## 7. `ids.csv` 요구사항

파일 위치:

```text
ai-server/data/faiss/ids.csv
```

형식:

```csv
application_number
4020220126402
```

용도:

- 임베딩 행과 상표 출원번호가 올바르게 연결됐는지 검증한다.
- `trademarks.csv`와 `embeddings.npy`의 순서가 어긋난 사고를 탐지한다.

## 8. 데이터 매니페스트 요구사항

파일 위치:

```text
ai-server/data/faiss/data_manifest.json
```

예시:

```json
{
  "datasetVersion": "2026-08-10-v1",
  "recordCount": 7423,
  "embeddingDimension": 768,
  "embeddingDtype": "float32",
  "modelId": "facebook/dinov2-base",
  "modelRevision": "고정된 Hugging Face revision",
  "generatedAt": "2026-08-10T12:00:00+09:00",
  "metadataSha256": "...",
  "embeddingsSha256": "...",
  "idsSha256": "..."
}
```

모델 revision은 고정해야 한다. 같은 데이터로 다시 생성했을 때 다른 모델 버전이 자동으로 받아지는 일을 막기 위함이다.

## 9. Docker 저장 위치

로컬과 Docker 컨테이너는 다음처럼 연결된다.

```text
로컬:   ./ai-server/data
Docker: /app/data
```

`docker-compose.local.yml` 볼륨 계약:

```yaml
volumes:
  - ./ai-server/data:/app/data
```

컨테이너에서 실제로 읽어야 하는 경로:

```text
/app/data/faiss/embeddings.npy
/app/data/faiss/ids.csv
/app/data/faiss/data_manifest.json
/app/data/trademarks/meta/trademarks.csv
/app/data/trademarks/...실제 이미지 파일
```

## 10. 경로 설정 통일 요구사항

현재 설정과 실행 코드가 다르므로 다음 중 하나로 통일해야 한다.

권장 방식:

```text
EMBEDDINGS_PATH=/app/data/faiss/embeddings.npy
TRADEMARK_METADATA_PATH=/app/data/trademarks/meta/trademarks.csv
TRADEMARK_DATA_ROOT=/app/data/trademarks
DATA_MANIFEST_PATH=/app/data/faiss/data_manifest.json
```

AI 코드는 환경변수를 실제로 사용해야 하며 하드코딩 경로와 사용되지 않는 설정을 남기지 않는다.

현재 사용되지 않는 다음 설정은 제거하거나 실제 구현과 맞게 변경한다.

```text
FAISS_INDEX_PATH=/app/data/faiss/trademark.index
METADATA_STORE_PATH=/app/data/faiss/metadata.json
```

## 11. 유사도 API 계약

### 요청

```http
POST /api/v1/similarity/search
Content-Type: application/json
```

```json
{
  "imageBase64": "PNG 이미지의 Base64 문자열",
  "logoStyle": "combination",
  "topK": 3
}
```

규칙:

- 필드명은 camelCase를 사용한다.
- `imageBase64`는 `data:image/png;base64,` 접두사 없는 순수 Base64 문자열이다.
- 백엔드가 보내는 이미지는 PNG이다.
- `logoStyle`은 현재 `combination`만 사용한다.
- `topK`는 현재 `3`이다.
- Base64 원문을 로그에 출력하지 않는다.

### 성공 응답

```json
{
  "maxSimilarity": 48,
  "riskLevel": "MODERATE",
  "matches": [
    {
      "rank": 1,
      "applicationNumber": "4020220126402",
      "name": "비교 상표명",
      "category": "03류 · 결합상표",
      "similarity": 48,
      "imagePath": "raw/IMG/4020220126402_tm000001.jpg"
    },
    {
      "rank": 2,
      "applicationNumber": "...",
      "name": "...",
      "category": "...",
      "similarity": 41,
      "imagePath": "..."
    },
    {
      "rank": 3,
      "applicationNumber": "...",
      "name": "...",
      "category": "...",
      "similarity": 35,
      "imagePath": "..."
    }
  ],
  "disclaimer": "본 분석은 참고 자료이며 법률 판단을 대신하지 않습니다."
}
```

필수 검증:

- `maxSimilarity`: 0~100 정수
- `riskLevel`: `SAFE`, `MODERATE`, `CAUTION` 중 하나
- `matches`: `topK`와 같은 개수. 현재 정확히 3개
- `rank`: 1부터 순서대로 증가
- `similarity`: 0~100 정수, 높은 순으로 정렬
- `applicationNumber`, `name`, `category`: 빈 문자열 금지
- `imagePath`: 실제 데이터에 존재하는 상대경로
- `disclaimer`: 빈 문자열 금지
- `maxSimilarity`: `matches[0].similarity`와 같아야 함

### 위험도 규칙

현재 계약:

| 점수 | 위험도 |
|---:|---|
| 0~29 | `SAFE` |
| 30~59 | `MODERATE` |
| 60~100 | `CAUTION` |

점수 계산 책임은 AI 서버에 있다. 백엔드는 반환된 점수를 다시 계산하지 않는다.

## 12. 오류 응답 요구사항

| 상황 | 권장 HTTP 상태 |
|---|---:|
| 필수 필드 누락·잘못된 `topK` | 422 |
| Base64 디코딩 실패 | 400 |
| 지원하지 않는 이미지 | 400 |
| 데이터·인덱스 미설치 | 503 |
| 모델 로딩 실패 | 503 |
| 검색 중 예상하지 못한 오류 | 500 |

데이터가 없을 때 가짜 결과나 빈 `matches`를 `200`으로 반환하면 안 된다.

오류 응답에는 원인을 구분할 수 있는 안정적인 코드가 있어야 한다.

예시:

```json
{
  "code": "SIMILARITY_DATA_NOT_READY",
  "message": "Trademark embeddings or metadata are not ready."
}
```

## 13. Health Check 요구사항

```http
GET /health
```

검색 준비 완료:

```json
{
  "status": "ready",
  "recordCount": 7423,
  "embeddingDimension": 768,
  "metadataCount": 7423,
  "modelId": "facebook/dinov2-base"
}
```

데이터 미설치 또는 건수 불일치:

```http
HTTP 503
```

```json
{
  "status": "not_ready",
  "reason": "Embedding and metadata counts do not match."
}
```

단순히 FastAPI 프로세스가 켜졌다는 이유만으로 `status=ok`를 반환하지 않는다.

## 14. 시작 시 검증 요구사항

AI 서버 시작 시 다음을 검사한다.

1. 필수 파일이 모두 존재하는가?
2. `embeddings.npy` dtype이 `float32`인가?
3. 임베딩 차원이 768인가?
4. NaN 또는 Infinity가 없는가?
5. CSV 행 수, ids 행 수, 임베딩 행 수가 같은가?
6. 각 `image_path` 파일이 존재하는가?
7. 출원번호가 중복되지 않는가?
8. 모델과 데이터 버전이 매니페스트와 일치하는가?

검증 실패 시 검색 준비 상태를 `not_ready`로 표시하고 구체적인 오류를 로그에 남긴다.

## 15. 테스트 요구사항

### 단위 테스트

- 정상 Base64 PNG 입력
- 잘못된 Base64 입력
- 빈 이미지 입력
- `topK=3` 결과 개수
- 점수 0~100 범위
- 점수 내림차순 정렬
- 위험도 경계값 29/30/59/60
- 중복 이미지 제거
- 데이터와 임베딩 행 수 불일치
- 데이터 파일 누락

### API 테스트

현재 잘못된 테스트 요청:

```json
{"image_url": "test.png", "top_k": 3}
```

다음 실제 계약으로 수정한다.

```json
{
  "imageBase64": "실제 테스트 PNG의 Base64",
  "logoStyle": "combination",
  "topK": 3
}
```

### 통합 테스트

```text
실제 생성 로고 PNG
→ DINOv2 임베딩
→ FAISS 검색
→ 상위 3개 상표
→ API 응답
→ 백엔드 DB 저장
```

## 16. 완료 조건

다음 항목을 모두 만족해야 AI 팀 작업 완료로 본다.

- [ ] 실제 상표 이미지와 메타데이터가 전달됨
- [ ] `trademarks.csv`와 이미지 경로가 유효함
- [ ] `embeddings.npy`가 float32 `(N, 768)` 형식임
- [ ] CSV·ids·임베딩의 N이 동일함
- [ ] 데이터 매니페스트와 SHA-256 체크섬이 제공됨
- [ ] Docker 컨테이너에서 데이터가 정상 로드됨
- [ ] `/health`가 실제 준비 상태를 반환함
- [ ] `/api/v1/similarity/search`가 정확히 3개 결과를 반환함
- [ ] camelCase API 계약 테스트가 통과함
- [ ] 빈 데이터에서 가짜 성공 응답을 반환하지 않음
- [ ] 실제 생성 로고로 통합 테스트가 통과함
- [ ] 실행 명령과 데이터 설치 방법이 문서화됨

## 17. AI 팀 전달 시 함께 요청할 정보

AI 팀은 PR 또는 인수인계 문서에 다음 내용을 작성한다.

1. 데이터 다운로드 위치
2. 데이터 라이선스와 사용 가능 범위
3. 압축파일 SHA-256
4. 압축 해제 후 정확한 폴더 구조
5. 전처리 명령
6. 임베딩 생성 명령
7. 사용 모델 ID와 revision
8. 최종 데이터 건수
9. CPU/GPU별 예상 생성 시간
10. 실제 API 요청·응답 예시
11. 알려진 제한사항

## 18. AI 팀 범위 밖 작업

다음은 백엔드·프론트 담당이다.

- 회원 로그인과 `members` 테이블 복구
- 프로젝트·로고 후보 소유권 검사
- 분석 결과를 MariaDB에 저장
- 프론트 결과 화면 표시
- `imagePath`를 브라우저에서 볼 수 있게 제공하는 이미지 API
- 생성 로고 원본 다운로드 기능

다만 AI 팀은 `imagePath`가 실제 데이터 파일과 연결되는 안정적인 상대경로를 반환해야 한다.
