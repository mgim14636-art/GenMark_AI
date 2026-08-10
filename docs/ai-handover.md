# GenMark AI — 상표 유사도 검색 인수인계

> 대상: 백엔드·프론트 팀 및 AI 서버를 로컬에서 띄워야 하는 모든 팀원
> 기준 요구사항: `AI 팀 요구사항 정의서` §17
> 작성일: 2026-08-10 / 데이터셋 버전 `2026-08-10-v1`

---

## 0. 3분 요약

```powershell
# 0) 데이터 2개 파일 다운로드 (아래 §1 드라이브 링크)
#    https://drive.google.com/drive/folders/1d3CgUBZeFeAjC6yLvkk_C0bZy_SFMJIG?usp=sharing

# 1) 인덱스 번들 + KIPRIS 원본으로 데이터 복원
python ai-server/scripts/restore_data.py `
  --index-zip  <다운로드>/genmark-index-2026-08-10-v1.zip `
  --kipris-zip <다운로드>/KI202608051108150001.zip

# 2) 컨테이너 기동
docker compose -f docker-compose.local.yml up --build ai-server

# 3) 준비 상태 확인 — status가 ready 여야 한다
curl http://localhost:8000/health
```

임베딩은 이미 생성돼 있으므로 **재빌드가 필요 없습니다.** (재빌드 시 CPU 2~4시간)

---

## 1. 데이터 다운로드 위치

| 파일 | 크기 | 내용 | 필수 |
|---|---:|---|:--:|
| `genmark-index-2026-08-10-v1.zip` | 21.4MB | `embeddings.npy`, `ids.csv`, `data_manifest.json`, `trademarks.csv` | O |
| `KI202608051108150001.zip` | 453MB | KIPRIS 벌크 원본 (TXT 9개 + 이미지 8,517장) | O |

**다운로드:** https://drive.google.com/drive/folders/1d3CgUBZeFeAjC6yLvkk_C0bZy_SFMJIG?usp=sharing

폴더 안에 `README.txt`(설치 방법·체크섬)가 함께 들어 있습니다.

> 인덱스 번들만으로도 검색 API는 동작하지만, 시작 검증이 `image_path` 실존을 확인하므로
> KIPRIS 원본 없이 띄우려면 `STRICT_IMAGE_CHECK=false` 를 설정해야 합니다.
> 프론트에 상표 이미지를 노출하려면 원본이 반드시 필요합니다.

### SHA-256

```
ae91020b9129a77dc8a7f2a91d9f1be5a00f6afdf1a7675897af640c3a64cab8  genmark-index-2026-08-10-v1.zip
6b9e673546f3977f4c87e957bca861182d65811440cba9b7e21a3703fe23791c  KI202608051108150001.zip
```

개별 데이터 파일:

```
daad606982a25f3db4f82ee00d5974bf65cdc8af505f949033431dbab66a75bb  data/faiss/embeddings.npy
210144230cd485039a06b56d4d0dd26c6149b03fbed64e5762025192b1cc74fc  data/faiss/ids.csv
458d78f8dbd0adff4aacfd22def63ee42257525375cb080f0bd666257cdfc516  data/trademarks/meta/trademarks.csv
```

검증:

```powershell
Get-FileHash .\genmark-index-2026-08-10-v1.zip -Algorithm SHA256
```

---

## 2. 데이터 라이선스와 사용 가능 범위

| 항목 | 내용 |
|---|---|
| 출처 | KIPRIS Plus 벌크 데이터(선택형) / 한국특허정보원 |
| 취득 방법 | KIPRIS Plus API 키 기반 벌크 다운로드 |
| 범위 | 3류(화장품) 도형복합 **등록** 상표 |
| 용도 | 프로젝트 내부 유사도 분석·시연 |

**주의**

- 원본 이미지·메타데이터를 **공개 저장소나 외부에 재배포하지 않습니다.** 팀 내부 공유 스토리지에만 둡니다.
- 상용 서비스 또는 외부 공개 전에는 KIPRIS Plus 이용약관 재확인이 필요합니다.
- 산출물(유사도 점수)은 참고 자료이며 법적 판단을 대신하지 않습니다. 응답 `disclaimer` 필드에 명시돼 있습니다.

---

## 3. 압축 해제 후 폴더 구조

`restore_data.py` 실행 후 아래 상태가 됩니다.

```text
ai-server/data/
├─ trademarks/
│  ├─ raw/cosmetic_9000/DBII_000000000000012/
│  │  ├─ TXT/          TB_KT10 · TB_KT11 · TB_KT15 등 9개
│  │  └─ IMG/          8,227장 (CSV 참조 7,423 + 비대상 804)
│  └─ meta/
│     └─ trademarks.csv          7,423행
├─ faiss/
│  ├─ embeddings.npy             (7423, 768) float32
│  ├─ ids.csv                    7,423행
│  └─ data_manifest.json
├─ dist/                         배포용 번들 (git 제외)
└─ outputs/
```

`data/` 전체가 `.gitignore` 대상입니다. **git에 올리지 마세요.**

컨테이너 매핑:

```yaml
volumes:
  - ./ai-server/data:/app/data
```

---

## 4. 전처리 명령

CSV를 새로 만들 때만 필요합니다. (TXT 원본 필요)

```powershell
cd ai-server
python scripts/preprocess.py
```

동작: `TB_KT10`에서 `상표구분코드명 == "도형복합"`만 추출 → `TB_KT11`(비엔나) · `TB_KT15`(류/유사군) 조인 → 이미지가 실제로 존재하는 행만 남겨 `meta/trademarks.csv` 저장.

한글 컬럼 ↔ 계약 표준 필드 매핑:

| CSV 컬럼 | 표준 필드 |
|---|---|
| `출원번호` | `application_number` |
| `상표한글명` | `name_ko` |
| `상표영문명` | `name_en` |
| `상표구분코드명` | `trademark_type` |
| `류` | `class_codes` (`\|` 구분) |
| `유사군` | `similar_group_codes` (`\|` 구분) |
| `이미지경로` | `image_path` (`data/trademarks/` 기준 상대경로) |

---

## 5. 임베딩 생성 명령

> **평소에는 실행하지 마세요.** 배포된 `embeddings.npy`를 그대로 쓰면 됩니다.
> CSV가 바뀐 경우에만 재실행합니다.

```powershell
cd ai-server
python scripts/build_index.py
```

산출물: `embeddings.npy`, `ids.csv`, `data_manifest.json` (SHA-256 3종 포함)

**불변 규칙**

```text
trademarks.csv N번째 행 = embeddings.npy N번째 벡터 = ids.csv N번째 출원번호
```

임베딩 생성 후 CSV 행 순서를 절대 바꾸지 마세요. 순서가 어긋나면 검색 결과에 엉뚱한 상표 정보가 붙습니다. `restore_data.py --verify-only` 가 이 사고를 탐지합니다.

---

## 6. 사용 모델

| 항목 | 값 |
|---|---|
| 모델 ID | `facebook/dinov2-base` |
| revision | `f9e44c814b77203eaa57a6bdbbd535f21ede1415` |
| 벡터 | CLS 토큰 768차원, 행별 L2 정규화 |
| 유사도 | 정규화 후 내적 = 코사인 (FAISS `IndexFlatIP`) |

revision을 커밋 SHA로 고정했습니다. `main`으로 두면 모델이 갱신될 때 임베딩이 조용히 어긋납니다.

---

## 7. 최종 데이터 건수

| 단계 | 건수 |
|---|---:|
| 벌크 zip 이미지 | 8,517 |
| 도형복합 + 이미지 존재 → 최종 | **7,423** |

목표치 7,423건과 일치하며 제외 사유는 "도형복합이 아니거나 이미지 미존재"입니다.

---

## 8. 생성 시간 (참고)

| 환경 | 7,423건 임베딩 |
|---|---|
| CPU (batch 32) | 약 2~4시간 |
| GPU (CUDA) | 약 10~20분 |

`build_index.py`가 CUDA를 자동 감지합니다. **재빌드가 필요 없는 상황이라면 돌리지 마세요.**

---

## 9. API 요청·응답 예시

### 요청

```http
POST /api/v1/similarity/search
Content-Type: application/json
```

```json
{
  "imageBase64": "iVBORw0KGgoAAAANSUhEUg...",
  "logoStyle": "combination",
  "topK": 3
}
```

- 필드명은 **camelCase**. `imageBase64`는 `data:image/png;base64,` 접두사 없는 순수 Base64.
- `logoStyle`은 **`combination` 또는 `symbol`만 허용**. 그 외는 422.
  기준 DB가 도형복합 상표뿐이라 도형이 없는 로고는 형태가 아니라 레이아웃이 유사도를
  지배합니다. 실측 top-1 코사인 중앙값이 워드마크 0.94 · 레터마크 0.93 으로,
  등록 상표 간 최근접 중앙값(0.89)보다 높은 오탐이 확인됐습니다.
- `topK`는 1~20 (현재 3).

### 성공 응답 (200)

```json
{
  "maxSimilarity": 48,
  "riskLevel": "MODERATE",
  "matches": [
    {
      "rank": 1,
      "applicationNumber": "4020220126402",
      "name": "젠마크",
      "category": "03류 · 도형복합",
      "similarity": 48,
      "imagePath": "raw/cosmetic_9000/DBII_000000000000012/IMG/4020220126402_tm000001.jpg",
      "note": "방패 외곽선과 중앙 분할 구도가 닮았어요"
    }
  ],
  "disclaimer": "본 분석은 로고 이미지의 시각적 유사성을 보여주는 참고 자료이며, 상표 등록 가능 여부나 법적 침해 여부를 판단하지 않습니다."
}
```

`imagePath`는 `data/trademarks/` 기준 상대경로입니다.

**`note`는 없을 수 있습니다.** 검출된 상표가 왜 닮았는지에 대한 한 줄 설명(Gemini)으로,
외부 API 실패·타임아웃·콘텐츠 필터링 시 생략됩니다. 그래도 응답은 200 정상이므로
소비 측은 `null`을 전제해야 합니다.

### ⚠️ 상표 도면 이미지는 화면에 노출하지 않습니다 (2026-08-10 결정)

`imagePath`는 응답에 계속 포함되지만 **사용자 화면에는 표시하지 않습니다.**
KIPRIS 상표 도면을 서비스 화면에 그대로 게시하는 것은 데이터 재배포에 해당할 수 있어,
이용 범위가 확정되기 전까지 노출하지 않기로 했습니다.

- 백엔드: `imagePath`를 DB에는 저장하되 프론트 응답 DTO에서는 제외
- 프론트: 상표명·출원번호·유사도 점수·`note`만 표시
- 원본 확인이 필요한 사용자를 위해 KIPRIS 상세 링크를 제공하는 방안 검토
  (출원번호는 공개 정보이므로 링크 제공은 재배포에 해당하지 않음)

이미지를 감추면 `note`가 사용자에게 제공되는 **유일한 근거**가 됩니다.

### 점수·위험도

점수는 AI 서버가 계산하며 **백엔드는 재계산하지 않습니다.**

원시 **코사인 유사도**를 구간별 선형으로 매핑합니다. 앵커는 모두 실측값입니다
(`scripts/calibrate_score.py`, DB 30장 + 생성 로고 44장).

| 코사인 | 점수 | 근거 |
|---:|---:|---|
| 0.42 | 0 | 코퍼스 쌍별 평균(0.488) 아래 = 무작위 상표 쌍 수준 |
| **0.80** | **30** | 생성 로고 top-1 코사인 p95 = SAFE 상한 |
| **0.89** | **60** | 등록 상표 간 최근접 중앙값 = 이미 공존 등록된 수준 |
| 1.00 | 100 | 사실상 동일 |

> 초기 구현은 z 점수(쿼리별 평균·표준편차로 정규화)를 썼으나 폐기했습니다.
> z는 쿼리마다 기준이 달라져 비교가 불가능하고, 실측에서 **동일 이미지(코사인 1.0)가
> 40점, 무관한 생성 로고가 49점**으로 나오는 역전이 확인됐습니다.

| 점수 | riskLevel |
|---:|---|
| 0~29 | `SAFE` |
| 30~59 | `MODERATE` |
| 60~100 | `CAUTION` |

### 오류 응답

모든 오류는 안정적인 `code`를 포함합니다.

```json
{ "code": "SIMILARITY_DATA_NOT_READY", "message": "..." }
```

| 상황 | HTTP | code |
|---|---:|---|
| 필수 필드 누락 · 잘못된 `topK` · snake_case 요청 | 422 | `SIMILARITY_INVALID_REQUEST` |
| Base64 디코딩 실패 | 400 | `SIMILARITY_INVALID_BASE64` |
| 이미지 형식 미지원 · 과소 이미지 | 400 | `SIMILARITY_UNSUPPORTED_IMAGE` |
| 데이터·인덱스 미설치 | 503 | `SIMILARITY_DATA_NOT_READY` |
| 모델 로딩 실패 | 503 | `SIMILARITY_MODEL_NOT_READY` |
| 그 외 | 500 | `SIMILARITY_SEARCH_FAILED` |

데이터가 없을 때 **가짜 성공(200 + 빈 `matches`)을 반환하지 않습니다.**

### Health Check

```http
GET /health
```

준비 완료 (200):

```json
{
  "status": "ready",
  "recordCount": 7423,
  "embeddingDimension": 768,
  "metadataCount": 7423,
  "modelId": "facebook/dinov2-base",
  "datasetVersion": "2026-08-10-v1"
}
```

미준비 (503):

```json
{ "status": "not_ready", "reason": "Embedding and metadata counts do not match." }
```

프로세스가 떴다는 이유만으로 `status=ok`를 반환하지 않습니다. **배포 헬스체크는 이 엔드포인트의 상태 코드를 그대로 쓰면 됩니다.**

---

## 10. 환경변수

```env
EMBEDDINGS_PATH=/app/data/faiss/embeddings.npy
IDS_PATH=/app/data/faiss/ids.csv
DATA_MANIFEST_PATH=/app/data/faiss/data_manifest.json
TRADEMARK_METADATA_PATH=/app/data/trademarks/meta/trademarks.csv
TRADEMARK_DATA_ROOT=/app/data/trademarks
DINO_MODEL_ID=facebook/dinov2-base
DINO_MODEL_REVISION=f9e44c814b77203eaa57a6bdbbd535f21ede1415
STRICT_IMAGE_CHECK=true

# note(유사 이유 설명)용. 없으면 note 없이 유사도만 반환한다.
GEMINI_API_KEY=
GEMINI_MODEL=gemini-flash-latest
NOTE_TIMEOUT_SECONDS=8
```

- 미설정 시 리포지토리 구조 기준 기본값(`ai-server/data/...`)을 사용하므로 로컬 실행에는 별도 설정이 필요 없습니다.
- `FAISS_INDEX_PATH`, `METADATA_STORE_PATH`는 **제거되었습니다.** 실제 구현이 쓰지 않던 값입니다.

---

## 11. 시작 시 검증

서버 기동 시 아래 8항목을 검사하고, 하나라도 실패하면 `not_ready` 로 표시하며 구체적 사유를 로그에 남깁니다.

1. 필수 파일 존재
2. `embeddings.npy` dtype `float32`
3. 차원 768
4. NaN/Infinity 없음
5. CSV · ids · 임베딩 행 수 일치
6. 각 `image_path` 파일 존재
7. 출원번호 중복 없음
8. 매니페스트의 모델·건수 일치

추가로 `ids.csv`와 `trademarks.csv`의 **순서 일치**까지 검사합니다.

수동 검증:

```powershell
python ai-server/scripts/restore_data.py --verify-only
```

---

## 12. 테스트

```powershell
cd ai-server
pytest tests/ -q
```

- 계약 테스트는 DINOv2 추론을 스텁으로 대체하므로 모델 없이도 실행됩니다.
- torch/transformers 미설치 환경에서는 `tests/conftest.py`가 최소 스텁을 주입하고, 실제 모델이 필요한 테스트는 자동 skip 됩니다.
- 커버 범위: 점수 clamp·정수화·NaN, 위험도 경계값 29/30/59/60, `topK` 개수, 내림차순 정렬, 빈 문자열 금지, camelCase 계약, snake_case 거부, 400/422/503 오류 코드, Base64 미노출, `/health` 준비 상태.

---

## 13. 알려진 제한사항

1. **점수 분포가 MODERATE에 쏠립니다.** 현재 앵커링에서 `CAUTION`(60점) 진입에는 z ≈ 4.91이 필요합니다. 보수적 설계이므로 대부분의 생성 로고는 MODERATE로 나옵니다. 기획 의도와 맞는지 확인이 필요합니다.
2. **시각 유사도만 봅니다.** 상표명(텍스트), 지정상품 유사군, 비엔나 코드는 점수에 반영되지 않습니다. `class_codes`·`similar_group_codes`는 CSV에 있으나 미사용입니다.
3. **대상 범위가 3류 도형복합 등록상표뿐입니다.** 다른 류·상표 구분은 검색되지 않습니다.
4. **`note`는 외부 LLM(Gemini)에 의존합니다.** 실패·타임아웃 시 생략되며 응답은 정상입니다.
   법적 판단 표현은 프롬프트와 서버 금칙어 필터로 이중 차단하지만, LLM 출력이므로
   100% 보장은 아닙니다. 응답 시간이 요청당 1~3초 늘어납니다.
5. **문자 전용 로고(워드마크·레터마크)는 분석 대상이 아닙니다.** 도형복합 상표 DB로는
   판정이 불가능해 422로 거절합니다. 도형상표·문자상표 인덱스를 추가하면 확장 가능하며,
   KIPRIS 원본에 해당 데이터가 이미 포함되어 있습니다.
6. **임베딩이 색상 정보를 포함합니다.** 형태가 유사해도 색상이 크게 다르면 유사도가 낮게
   산출될 수 있습니다. 그레이스케일 임베딩 병행으로 보완 가능하나 재빌드가 필요합니다.
5. **이미지 실존 검사가 시작 시간을 늘립니다.** 7,423회 파일 확인이라 느린 스토리지에서 수십 초가 걸립니다. `STRICT_IMAGE_CHECK=false`로 경고만 남기게 할 수 있습니다.
6. **중복 제거는 코사인 0.99 임계값 기준입니다.** 사실상 동일한 이미지는 상위 결과에서 1건만 남습니다.
7. **`data/` 는 git 관리 대상이 아닙니다.** 새 팀원은 반드시 §0 절차로 복원해야 하며, 복원 전에는 `/health`가 503을 반환합니다.

---

## 14. 문제 해결

| 증상 | 원인 | 조치 |
|---|---|---|
| `/health` 503 `Required data files are missing` | 데이터 미복원 | §0 절차 실행 |
| `/health` 503 `N image files ... are missing` | 이미지 일부 유실 | `restore_data.py --kipris-zip ...` |
| `/health` 503 `counts do not match` | CSV/임베딩 불일치 | 인덱스 번들 재다운로드 (재빌드 금지) |
| `503 SIMILARITY_MODEL_NOT_READY` | HF 모델 다운로드 실패 | 네트워크·`HUGGINGFACE_TOKEN` 확인 |
| `422 SIMILARITY_INVALID_REQUEST` | snake_case 요청 | `imageBase64`/`logoStyle`/`topK` 로 수정 |
| `ids.csv and trademarks.csv order diverge` | 행 순서 훼손 | CSV 원복 또는 `build_index.py` 재실행 |

---

## 15. AI 팀 범위 밖

백엔드·프론트 담당입니다.

- 회원 로그인 및 `members` 테이블
- 프로젝트·로고 후보 소유권 검사
- 분석 결과 MariaDB 저장
- 프론트 결과 화면
- ~~`imagePath`를 브라우저에 서빙하는 이미지 API~~ → 상표 도면 비노출 결정으로 보류 (§9 참고)
- 프론트 응답 DTO에서 `imagePath` 제외
- `trademark_matches` 테이블에 `note` 컬럼 추가 (V11), 엔티티·DTO 반영
- 생성 로고 원본 다운로드

AI 서버는 `imagePath`가 실제 데이터 파일과 연결되는 안정적인 상대경로임을 보장합니다.
