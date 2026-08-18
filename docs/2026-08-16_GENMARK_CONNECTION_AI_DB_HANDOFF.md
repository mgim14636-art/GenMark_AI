# GenMark 화면·API·DB·AI 연결 점검 및 V24·V25 적용 인계서

- 작성일: 2026-08-16
- 기준 브랜치: `develop`
- 기준 커밋: `f349f89`
- 점검 범위: 프론트 화면 입력, Spring API, MariaDB 저장, FastAPI AI 생성, Docker 실행 상태

## 1. 한눈에 보는 결론

현재 프론트엔드, 백엔드, AI 서버, Nginx가 모두 기동된다. 화면에서 입력한 CI/BI 프로젝트 정보가 Spring DTO와 엔티티를 거쳐 DB에 저장되고, 생성 시 AI 서버용 snake_case 입력으로 변환되는 기본 연결도 일치한다.

점검 당시에는 연결 DB에 V25가 적용되지 않아 백엔드가 다음 오류로 기동하지 못했다. V24의 `business_card_infos` 테이블은 이미 존재했다.

```text
Schema-validation: missing column [color_mode] in table [bi_project]
```

2026-08-16에 대상 테이블을 백업한 뒤 `V25__add_project_color_mode_and_logo_shape.sql`을 적용했다. 이후 Hibernate 스키마 검증과 백엔드 기동이 정상화됐다. 새 환경이 아닌 기존 DB에 전체 변경을 반영할 때는 V24를 먼저 적용하고 V25를 적용해야 한다.

아직 수정해야 할 화면·계약 불일치가 일부 남아 있다. 상세 내용은 8절을 참고한다.

## 2. 이번에 수행한 작업

1. `git fetch --prune origin`으로 원격 브랜치를 갱신했다.
2. 현재 `develop`과 `origin/develop`이 동일함을 확인했다.
3. `origin/frontend`의 변경은 이미 `develop`에 포함되어 있어 pull이나 merge는 하지 않았다.
4. 프론트엔드 정적 파일을 다시 빌드했다.
5. `docker-compose.local.yml` 기준으로 backend와 ai-server 이미지를 재빌드했다.
6. 연결 DB의 V24 테이블 존재 여부와 V25 적용 전 컬럼·행 수를 읽기 전용으로 확인했다.
7. `ci_project`, `bi_project`를 SQL로 백업했다.
8. V24 적용 상태를 확인한 뒤 V25를 적용하고 컬럼, 기본값, CHECK 제약, 기존 데이터 보정 결과를 검증했다.
9. backend를 재기동하고 Backend 직접 접근, Nginx 프록시, AI health를 확인했다.
10. 프론트엔드 빌드, 백엔드 테스트, AI 전체 테스트를 실행했다.

## 3. 현재 실행 상태

| 구성요소 | 상태 | 확인 내용 |
|---|---|---|
| Frontend | 정상 | Vite production build 성공 |
| Nginx | 정상 | `http://localhost/` HTTP 200 |
| Backend | 정상 | Spring Boot 기동 및 MariaDB 스키마 검증 통과 |
| Backend API | 정상 | 비로그인 요청에 HTTP 401 `AUTH_REQUIRED` 반환 |
| AI Server | 정상 | `/health`가 `ready` 반환 |
| DINOv2 | 정상 | 768차원 임베딩 모델 로드 |
| FAISS 데이터 | 정상 | 상표 7,423건 로드 |

비로그인 API의 401은 오류가 아니다. 서버, Nginx 프록시, Spring Security까지 요청이 정상 전달됐다는 의미다.

## 4. 서비스 핵심 로직

```text
화면에서 브랜드 정보 입력
  → CI/BI 프로젝트 저장
  → 생성 시점 입력을 request_snapshot_json으로 보존
  → FastAPI 로고 생성 요청
  → PNG/SVG 저장 및 후보 생성
  → 사용자 후보 선택
  → DINOv2 임베딩 + FAISS 상표 유사도 검색
  → 분석 결과 저장
  → 선택 로고로 명함 또는 브랜드 키트 생성
```

핵심은 사용자의 브랜드 의도를 구조화해서 보존하고, 그 값을 AI 프롬프트로 변환한 다음, 생성 결과를 상표 데이터와 비교하는 것이다.

주요 코드 경로는 다음과 같다.

- 화면 상태와 단계 이동: `frontend/src/App.tsx`
- 프론트 API 계약: `frontend/src/lib/genmarkApi.ts`
- CI 입력 변환: `backend/src/main/java/com/genmark/ai/entity/CiProject.java`
- BI 입력 변환: `backend/src/main/java/com/genmark/ai/entity/BiProject.java`
- 생성 스냅샷 저장: `backend/src/main/java/com/genmark/ai/service/LogoGenerationService.java`
- FastAPI 호출: `backend/src/main/java/com/genmark/ai/client/FastApiLogoAiClient.java`
- AI 입력 스키마: `ai-server/app/schemas/generation.py`
- 프롬프트 조립: `ai-server/app/services/prompt_service.py`
- 이미지 생성: `ai-server/app/services/logo_gen_service.py`
- 상표 유사도: `ai-server/app/services/dino_service.py`, `similarity_service.py`

## 5. 화면값, DB, AI 매핑

| 화면 입력 | DB 저장 위치 | AI 전달 키 |
|---|---|---|
| 온보딩 이용 목적 | `member_onboardings.usage_1~3` | 로고 AI에는 직접 전달하지 않음 |
| 온보딩 사용자 유형 | `member_onboardings.audience` | 로고 AI에는 직접 전달하지 않음 |
| CI 기업명 | `ci_project.company_name` | `company_name` |
| CI 핵심 가치·설명 | `ci_project.core_values` | `company_values_text` |
| BI 브랜드명 | `bi_project.brand_name` | `brand_name` |
| BI 가치 선택 3개 | `value_category_1~3` | `brand_values` 배열 |
| BI 브랜드 설명 | `brand_description` | `brand_values_text` |
| BI 타깃 연령 | `target_age` | `target_age` |
| 업종 | 각 프로젝트의 `industry` | `industry` |
| 톤 | `tone` | `tone` |
| 색상 방식 | `color_mode` | `manual` 또는 `ai` |
| 선택 색상 | `color_1~4` | `color_manual` 배열 |
| 로고 유형 | `logo_style` | `style` |
| 원하는 모티프 | `logo_shape` | `logo_shape` |
| 추가 요청 | `additional_requirements` | `additional_requirements` |
| 생성 당시 전체 입력 | `logo_generations.request_snapshot_json` | 생성 API body |
| 사용 모델 | `logo_generations.model_name` | AI 응답 `modelName` |
| 생성 PNG | 파일 저장소 + `logo_candidates.storage_key` | AI 응답 `imageBase64` |
| SVG | 비공개 파일 저장소 | AI 응답 `svg` |
| 상표 분석 | `trademark_analyses`, `trademark_matches` | DINO/FAISS 결과 |
| 명함 개인정보 | `business_card_infos` | `card_info` |
| 브랜드 키트 | `brand_kits` + 파일 저장소 | 로고, 프로젝트 설문, 명함 정보 |

`color_mode`는 DB에서 `TONE` 또는 `MANUAL`로 저장된다. AI 요청 시 `MANUAL`은 `manual`, 그 외는 `ai`로 변환된다. 수동 색상일 때만 `color_manual` 배열이 전송된다.

## 6. AI 모델과 환경변수

| 용도 | 기본 모델 | 주요 환경변수 |
|---|---|---|
| 심볼·조합형 로고 | `recraft/recraft-v4-vector` | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` |
| 워드마크·레터마크 | 로컬 Pillow 렌더링 | 외부 모델 없음 |
| 브랜드 가치 영문 키워드화 | `upstage/solar-pro4` | `VALUE_KEYWORD_MODEL` |
| 한글 모티프 번역 | `upstage/solar-pro4` | `MOTIF_TRANSLATION_MODEL` |
| 이미지 임베딩 | `facebook/dinov2-base` | `DINO_MODEL_ID`, `DINO_MODEL_REVISION` |
| 유사점 설명 | `google/gemini-2.5-flash-lite` | `NOTE_PROVIDER`, `NOTE_MODEL` |
| Gemini 직접 호출 | `gemini-flash-latest` | `GEMINI_API_KEY`, `GEMINI_MODEL` |

현재 환경에서는 `OPENROUTER_API_KEY`가 설정되어 있다. 실제 키 값은 문서에 기록하지 않는다. `GEMINI_API_KEY`, `KIPRIS_API_KEY`는 현재 설정되지 않았다.

### 로고가 만들어지는 방식

1. 업종, 톤, 색상, 가치 키워드, 모티프, 스타일을 정규화한다.
2. 한글 가치 설명과 모티프는 필요한 경우 짧은 영문 디자인 키워드로 변환한다.
3. Recraft에는 평면 벡터, 단순한 도형, 높은 완성도, 텍스트 금지 조건을 전달한다.
4. 이미지 모델이 글자를 틀리지 않도록 원격 생성에는 브랜드명을 직접 그리게 하지 않는다.
5. 생성된 심볼 위에 로컬 폰트로 정확한 브랜드명을 합성한다.
6. 워드마크와 레터마크는 Recraft 없이 로컬 Pillow 렌더링으로 만든다.

## 7. V24·V25 DB 마이그레이션 기록

### 기존 DB 적용 순서

Spring의 local/prod 설정은 `ddl-auto=validate`, `spring.flyway.enabled=false`이므로 SQL 파일이 자동 적용되지 않는다. 기존 DB를 새 코드에 맞출 때는 다음 순서를 지킨다.

1. `brand_kits`, `ci_project`, `bi_project`를 백업한다.
2. `database/migration/V24__create_business_card_infos.sql`을 적용한다.
3. `database/migration/V25__add_project_color_mode_and_logo_shape.sql`을 적용한다.
4. `business_card_infos` 테이블과 CI/BI의 `color_mode`, `logo_shape` 컬럼을 확인한다.
5. `color_mode`가 `TONE` 또는 `MANUAL`인지 확인한다.
6. Backend를 기동해 Hibernate 스키마 검증을 통과하는지 확인한다.

V24는 `IF NOT EXISTS`를 사용하므로 테이블이 이미 있는 환경에서는 테이블을 다시 만들지 않는다. 현재 연결 DB에는 V24 테이블이 이미 있어 V25만 추가 적용했다.

### 적용 전

- DB 버전: MariaDB `10.5.10`
- `ci_project`: 4행
- `bi_project`: 0행
- 두 테이블 모두 `color_mode`, `logo_shape` 없음
- 이 상태에서는 Hibernate `ddl-auto=validate` 실패

### 적용 파일

`database/migration/V25__add_project_color_mode_and_logo_shape.sql`

### 적용 내용

- `ci_project.color_mode VARCHAR(20)` 추가
- `ci_project.logo_shape VARCHAR(100)` 추가
- `bi_project.color_mode VARCHAR(20)` 추가
- `bi_project.logo_shape VARCHAR(100)` 추가
- 기존 색상 팔레트가 있는 프로젝트는 `MANUAL`로 보정
- 팔레트가 없는 프로젝트는 `TONE`으로 보정
- `color_mode NOT NULL DEFAULT 'TONE'` 설정
- `TONE`, `MANUAL` CHECK 제약 추가

### 적용 후 검증

- 컬럼 4개 생성 확인
- `chk_ci_color_mode`, `chk_bi_color_mode` 확인
- NULL 또는 허용되지 않은 `color_mode`: 0건
- 기존 CI 4행: 모두 `MANUAL`
- 기존 BI 데이터: 0행
- Backend Hibernate 스키마 검증 통과

### 백업

- 위치: `C:\Users\SMHRD\AppData\Local\Temp\GenMark_AI-db-backups\genmark-v25-before-20260816-105539.sql`
- 크기: 7,649 bytes
- SHA-256: `2804C3C2D65F7617A6A08A69E48AB5F83675EB7E681F4691460D73D08093C30E`
- 포함 테이블: `ci_project`, `bi_project`

백업 파일에는 서비스 데이터가 들어 있으므로 Git에 추가하거나 외부로 공유하지 않는다. 복원은 두 테이블을 덮어쓸 수 있는 작업이므로 반드시 별도 승인과 현재 데이터 재백업 후 수행한다.

## 8. 남은 연결 문제

### P1. 설문 상세값 미저장

화면은 만족도, 개선항목, 자유의견을 받지만 `POST /me/survey`는 request body 없이 호출된다. 현재 DB에는 참여 여부만 남고 답변 내용은 저장되지 않는다.

- 화면: `frontend/src/App.tsx`
- API: `frontend/src/lib/genmarkApi.ts`
- Backend: `backend/src/main/java/com/genmark/ai/web/controller/MeController.java`

### P1. 결과 설명 일부가 고정값

결과 화면의 디자인 방향, 추천 글씨체, 전달 느낌, 일부 색상 스와치는 AI 후보 응답과 연결되지 않은 프론트 고정값이다. 후보가 없을 때 목업 결과가 표시될 가능성도 있다.

### P1. 로고 편집 시 기존 팔레트 축소 가능

편집 화면에서 색상을 변경하면 기존 2~4색 팔레트 대신 한 색만 프로젝트에 저장할 수 있다. 이후 재생성 입력이 최초 입력과 달라질 수 있다.

### P2. DTO와 DB 검증 규칙 차이

`industry`, HEX 색상, BI `targetAge`는 DTO보다 DB가 엄격하다. 잘못된 값은 API 400 대신 DB 제약 오류로 늦게 실패할 수 있다.

### P2. 상표 유사점 note 소실

AI 서버가 생성한 유사점 설명 `note`를 Spring 계약이 받지 않아 DB와 화면으로 전달하지 않는다. 해당 AI 호출 비용을 쓰고 결과를 버릴 수 있다.

### P2. 브랜드 키트 임시 상태 소실

AI 응답의 `preliminary`, `warnings`를 Spring이 저장하거나 화면에 전달하지 않는다. BI 썸네일은 현재 완전한 AI 배경 생성이 아니라 톤 기반 그라데이션과 로컬 합성이다.

## 9. 검증 결과

```text
npm run build
→ 성공

mvn test
→ 71 tests, 0 failures, 0 errors, 1 skipped

docker compose -f docker-compose.local.yml exec -T ai-server python -m pytest -q
→ 164 passed, 9 warnings

GET http://localhost/
→ HTTP 200

GET http://localhost:8081/api/v1/me/onboarding
→ HTTP 401 AUTH_REQUIRED

GET http://localhost/api/v1/me/onboarding
→ HTTP 401 AUTH_REQUIRED

GET http://localhost:8000/health
→ status=ready, embeddingDimension=768, recordCount=7423
```

## 10. 팀 권장 작업 순서

1. 설문 request/DB 스키마를 확장해 실제 답변을 저장한다.
2. 결과 화면 고정 문구와 목업 후보를 실제 AI 후보 메타데이터로 교체한다.
3. 로고 편집 색상 변경 시 전체 팔레트를 보존한다.
4. 프로젝트 DTO에 업종, HEX, targetAge 검증을 추가한다.
5. 상표 `note`를 저장·응답할지, AI note 생성을 끌지 결정한다.
6. 브랜드 키트 `preliminary`, `warnings`를 사용자에게 표시할지 결정한다.
7. 향후 마이그레이션 적용 이력을 수동 파일이 아닌 Flyway 등으로 관리하는 방안을 검토한다.

## 11. 자주 쓰는 확인 명령

```powershell
git fetch --prune origin
git rev-list --left-right --count HEAD...origin/develop

npm run build
mvn test

docker compose -f docker-compose.local.yml up -d --build
docker compose -f docker-compose.local.yml ps
docker compose -f docker-compose.local.yml logs --tail 120 backend ai-server nginx

curl.exe http://localhost:8000/health
```

실제 비밀값, DB 비밀번호, OpenRouter API 키는 명령 출력이나 문서에 남기지 않는다.
