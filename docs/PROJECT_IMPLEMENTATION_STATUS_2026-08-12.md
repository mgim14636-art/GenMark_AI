# GenMark AI 전체 구현 현황

- 작성일: 2026-08-12
- 기준 브랜치: `develop`
- 기준 커밋: `69610dd693b4afabd2eefd42ae7889e149ae4fb7`
- 문서 목적: 실제 코드와 검증 결과를 기준으로 구현 완료·부분 구현·미구현 범위를 구분하고 다음 작업 순서를 합의한다.

## 상태 기준

| 표시 | 의미 |
|---|---|
| ✅ | 코드 경로가 연결되어 있고 관련 검증 근거가 있음 |
| 🟡 | 일부 구현됐지만 외부 연동·화면·계약·E2E 검증 등이 남음 |
| 🔴 | 화면이나 선언만 있거나 핵심 처리 경로가 없음 |
| ⚪ | 현재 환경에서 확정할 수 없음 |

> 파일이나 버튼이 존재한다는 이유만으로 구현 완료로 판단하지 않았다.

---

## 1. 한눈에 보는 결론

| 영역 | 상태 | 현재 판단 |
|---|---|---|
| 기반 구조 | 🟡 | Frontend, Backend, AI, DB, Infra가 분리돼 있으나 공식 실행·배포 기준이 여러 갈래임 |
| Frontend | 🟡 | 로그인부터 로고 생성·상표 분석까지 주요 API 호출 존재. 일부 화면은 고정 데이터 또는 local state |
| Backend | 🟡 | 인증, 프로젝트, 로고 생성, 분석, 핀, 다운로드 API 구현. 편집과 일부 조회 기능은 미완성 |
| Database | 🟡 | 주요 Entity와 schema 존재. 실제 운영 DB와 migration 적용 상태는 미확인 |
| AI | 🟡 | 이미지 생성, DINOv2·FAISS 분석, 임시 브랜드 키트 endpoint 존재. Recraft는 미연결 |
| Infra | 🟡 | 로컬 서비스 실행 가능. Compose별 환경변수와 배포 계약이 다름 |
| 테스트 | 🟡 | Backend 테스트·빌드와 Frontend 빌드 성공. AI pytest는 환경 부재로 미실행 |

### 가장 큰 미완성 항목

1. 기본 `docker-compose.yml`은 현재 이미지 생성 구현이 요구하는 `OPENROUTER_API_KEY`를 AI 서버에 전달하지 않는다.
2. API 문서의 통합 `/projects` 계약과 실제 `/ci-projects`, `/bi-projects` 구현이 다르다.
3. 로고 편집은 화면만 있고 실제 편집 API·저장·적용 로직이 없다.
4. 브랜드 키트는 작업 구조와 임시 합성만 있으며 Recraft 연동, 입력 화면, 결과 표시, 다운로드가 없다.
5. 마이페이지 완료 브랜드와 관리자 화면의 주요 데이터가 실제 DB 결과가 아닌 고정 데이터다.
6. 실제 운영 DB의 Flyway 적용 이력과 최신 schema 일치 여부가 확인되지 않았다.

---

## 2. 실제 프로젝트 구조

```text
GenMark_AI/
├─ frontend/                  React + TypeScript + Vite SPA
│  ├─ src/App.tsx             고객 화면과 핵심 사용자 이벤트
│  ├─ src/lib/                API, OAuth, token 처리
│  ├─ src/admin/              관리자 화면
│  └─ docs/                   Frontend PRD, 화면·API 문서
│
├─ backend/                   Spring Boot REST API
│  ├─ src/main/java/
│  │  └─ com/genmark/ai/
│  │     ├─ controller/       구형 MVC Controller
│  │     ├─ web/controller/   실제 `/api/v1` REST Controller
│  │     ├─ service/          업무 로직과 비동기 작업
│  │     ├─ repository/       Spring Data JPA
│  │     ├─ entity/           DB Entity
│  │     ├─ client/           FastAPI 호출 Client
│  │     ├─ security/         JWT 인증
│  │     ├─ oauth/            Google/Kakao/Fake OAuth
│  │     └─ config/           Security, Async, RestClient 설정
│  ├─ src/main/resources/     application 설정, Thymeleaf·정적 파일
│  └─ src/test/               JUnit, Mockito, H2 테스트
│
├─ ai-server/                 FastAPI AI 서버
│  ├─ app/main.py             애플리케이션 진입점
│  ├─ app/api/routes/         generation, similarity, brand-kit 등
│  ├─ app/services/           모델 호출·이미지 합성·유사도 처리
│  ├─ app/models/             DINO/이미지 모델 준비
│  ├─ app/vector_store/       FAISS index·metadata
│  ├─ data/                   embeddings와 상표 이미지
│  └─ tests/                  pytest
│
├─ database/
│  ├─ schema.sql              신규 DB bootstrap schema
│  ├─ seed.sql
│  └─ migration/              Flyway V1, V4~V22
│
├─ infra/
│  ├─ docker/                 별도 Dockerfile과 Compose
│  ├─ nginx/                  local/운영 proxy 설정
│  └─ scripts/                배포 스크립트
│
├─ docs/                      API, Postman, 인계·기획 문서
├─ .github/workflows/         AI CI, 수동 DB migration
├─ docker-compose.yml         README 기본 실행 구성
├─ docker-compose.local.yml   현재 로컬 실행 구성
└─ docker-compose.dev.yml     별도 개발 구성
```

### 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Java 17 대상, Spring Boot 3.2.3, Spring Security, JPA, JWT, Maven |
| AI | Python 3.11, FastAPI, PyTorch, DINOv2, FAISS, Pillow |
| Database | MariaDB 10.11, 테스트용 H2 |
| Infra | Docker Compose, Nginx, GitHub Actions |

---

## 3. 실제 서비스 실행 구조

```text
사용자
→ React Frontend
→ Spring Boot Backend
→ MariaDB
→ 비동기 Worker
→ FastAPI AI Server
→ 외부 이미지 모델 또는 DINOv2·FAISS
→ Backend 파일·DB 저장
→ Frontend polling
→ 사용자 결과 화면
```

### 로고 생성

```text
최종 입력 화면
→ POST /api/v1/projects/{projectId}/logo-generations
→ LogoGenerationService
→ logo_generations: QUEUED
→ LogoGenerationWorker
→ LogoGenerationProcessor
→ FastApiLogoAiClient
→ AI POST /api/v1/generation/generate
→ 이미지 파일 + logo_candidates 4건 저장
→ Frontend polling
→ 후보 결과 표시
```

### 상표 유사도 분석

```text
로고 후보 선택
→ POST /api/v1/projects/{projectId}/trademark-analyses
→ TrademarkAnalysisService
→ trademark_analyses: QUEUED
→ TrademarkAnalysisWorker
→ FastApiTrademarkAiClient
→ AI POST /api/v1/similarity/search
→ DINOv2 embedding + FAISS 검색
→ trademark_matches 저장
→ Frontend polling
→ 위험도·유사 상표 표시
```

---

## 4. 전체 기능 구현 현황

| 기능 | Frontend | Backend | DB | AI | 최종 판정 |
|---|---|---|---|---|---|
| Google/Kakao 로그인 | SDK·API 호출 구현 | OAuth 검증·JWT 구현 | members 저장 | 해당 없음 | 🟡 실제 OAuth 미검증 |
| Fake 로그인 | 개발 흐름 존재 | local provider 구현 | members 저장 | 해당 없음 | ✅ 개발 검증용 |
| 토큰 갱신·로그아웃 | 구현 | 구현 | refresh hash 저장 | 해당 없음 | ✅ |
| 온보딩 | 입력·저장 구현 | 구현 | member_onboardings | 해당 없음 | ✅ |
| CI 프로젝트 | 단계별 화면·API | 구현 | ci_project | 해당 없음 | ✅ |
| BI 프로젝트 | 단계별 화면·API | 구현 | bi_project | 해당 없음 | ✅ |
| 로고 생성 | 요청·polling·결과 화면 | 비동기 작업 구현 | generations/candidates | 이미지 생성 endpoint | 🟡 외부 E2E 미검증 |
| 후보 조회·선택 | 구현 | 구현 | selected 저장 | 해당 없음 | ✅ |
| 상표 분석 | 요청·polling·결과 화면 | 비동기 작업 구현 | analyses/matches | DINOv2·FAISS | 🟡 전체 E2E 미검증 |
| 상표 원본 이미지 | 화면 표시 경로 존재 | 권한·파일 조회 구현 | image_path | 해당 없음 | 🟡 브라우저 검증 필요 |
| 핀 | 버튼·상태 구현 | 구현 | pinned_at | 해당 없음 | ✅ |
| 다운로드 | Blob 다운로드 구현 | 구현 | logo_downloads | 해당 없음 | ✅ |
| 크레딧 조회 | 구현 | 구현 | members.credit_balance | 해당 없음 | ✅ |
| 크레딧 차감 | 화면 정책 없음 | consume 준비만 됨 | reason enum 존재 | 해당 없음 | 🔴 실제 호출 없음 |
| 설문 보상 | 제출 API 호출 | 구현 | member_surveys | 해당 없음 | 🟡 상세 의견 미저장 |
| 로고 편집 | 편집 화면 존재 | 편집 API 없음 | 저장 구조 없음 | 없음 | 🔴 |
| 브랜드 키트 | 버튼·상태 확인 일부 | 작업·DB·AI 호출 구조 | brand_kits | Pillow 임시 합성 | 🟡 기반 구조만 구현 |
| 마이페이지 핀·다운로드 | 일부 실제 API | 구현 | 관련 테이블 | 해당 없음 | 🟡 |
| 마이페이지 완료 브랜드 | 고정 카드 | 목록 API 없음 | 조회 연결 없음 | 해당 없음 | 🔴 |
| 관리자 로그인 | 구현 | 구현 | admins | 해당 없음 | ✅ |
| 관리자 dashboard API | 일부 호출 | 구현 | 집계 조회 | 해당 없음 | 🟡 화면 미반영 |
| 관리자 회원·차트 | 고정 데이터 중심 | 일부 API 구현 | 일부 조회 | 해당 없음 | 🟡 |
| 갤러리 | 고정 sample 데이터 | 없음 | 없음 | 없음 | 🔴 실제 서비스 기능 아님 |

---

## 5. Frontend 현황

### 구현됨

- React SPA 화면 전환
- Google/Kakao 로그인 진입
- access token 갱신과 인증 API 재시도
- 온보딩 입력과 저장
- CI/BI 프로젝트 단계별 입력
- 로고 생성 요청, 상태 polling, 후보 표시
- 후보 선택, 핀, 다운로드
- 상표 분석 요청, 상태 polling, 결과 표시
- 브랜드 키트 생성 요청과 상태 확인 일부
- 관리자 로그인과 일부 API 호출

### 부분 구현

- 프로젝트 상세 입력의 일부 단계는 서버 저장 전 local state에만 존재한다.
- 로고 생성·상표 분석 progress 문구는 실제 서버 진행률이 아니라 timer 기반이다.
- 브랜드 키트는 status만 표시하고 생성된 `storageKey` 이미지를 렌더링하지 않는다.
- 설문 rating, 의견, comment를 입력받지만 Backend request body에 보내지 않는다.
- 관리자 API 결과를 받지만 주요 차트와 회원 표가 실제 응답과 연결되지 않는다.

### 미구현 또는 고정 데이터

- 로고 편집값 저장·preview·apply
- 완료 프로젝트 목록 조회
- 마이페이지 완료 브랜드 카드
- 갤러리와 좋아요 서버 저장
- 브랜드 키트 입력 Wizard
- 제품·참고 이미지 업로드
- 브랜드 키트 결과 비교·다운로드

### 주요 근거

- `frontend/src/App.tsx`
- `frontend/src/auth.ts`
- `frontend/src/lib/genmarkApi.ts`
- `frontend/src/admin/AdminDashboard.tsx`

---

## 6. Backend 현황

### 구현됨

- JWT 인증·인가와 공통 401/403 처리
- Google/Kakao/Fake OAuth 검증 구조
- 공통 성공·오류 응답
- 온보딩 저장·조회
- CI/BI 프로젝트 생성·조회·수정·단계 저장
- 로고 생성 비동기 job과 idempotency
- 후보 조회·선택
- 상표 분석 비동기 job과 매치 저장
- 핀·다운로드·크레딧·설문
- 관리자 로그인과 일부 통계 API
- 브랜드 키트 job, Worker, Processor, 파일 저장

### 부분 구현

- 로고·상표 분석은 외부 AI 및 실제 DB를 포함한 사용자 E2E가 미검증이다.
- 브랜드 키트 단건 조회 Service는 있으나 Controller endpoint가 없다.
- 브랜드 키트 목록 응답과 Frontend 단건 타입이 다르다.
- 관리자 정지 상태는 실제 DB 상태가 아니라 `false` 고정값이다.
- 프로젝트 DTO validation에 필수값·색상 형식 검증이 부족하다.

### 미구현 또는 미사용

- 로고 편집 API와 저장 구조
- 완료 프로젝트 목록 API
- 브랜드 키트 Recraft 요청 계약
- 브랜드 키트 asset별 다운로드 API
- 실제 로고 생성·다운로드 크레딧 차감
- 일부 Repository·Service 메서드 호출처

### 주요 근거

- `backend/src/main/java/com/genmark/ai/web/controller/`
- `backend/src/main/java/com/genmark/ai/service/`
- `backend/src/main/java/com/genmark/ai/client/`
- `backend/src/main/java/com/genmark/ai/config/SecurityConfig.java`

---

## 7. Database 현황

### 코드와 정적 schema에서 확인된 테이블

- `members`
- `admins`
- `member_onboardings`
- `member_surveys`
- `credit_histories`
- `ci_project`
- `bi_project`
- `logo_generations`
- `logo_candidates`
- `logo_downloads`
- `trademark_analyses`
- `trademark_matches`
- `brand_kits`

### 구현됨

- 회원·프로젝트·생성·후보·분석·매치 간 FK
- 후보 순서와 매치 rank unique
- CI/BI 프로젝트별 generation idempotency unique
- 다운로드 회원·후보 unique
- OAuth provider/provider_id unique
- Entity와 주요 table·column 대응

### 확인 필요

- 실제 운영 DB table·column·constraint
- Flyway schema history
- V11, V20, V22 적용 여부
- `parent_generation_id` 실제 존재 여부
- 운영 MariaDB 버전

### 위험

- 애플리케이션의 local/prod 설정에서 Flyway가 비활성화돼 있다.
- production migration은 GitHub Actions 수동 실행이다.
- V11은 기존 핵심 테이블을 drop하고 CI/BI 구조로 재생성한다.
- V20은 데이터가 있으면 generation table rebuild를 건너뛸 가능성이 있다.
- `schema.sql`과 migration 적용 DB의 CHECK constraint 강도가 다를 수 있다.

---

## 8. AI Server 현황

### 구현된 endpoint

| Method | Path | 현재 상태 |
|---|---|---|
| GET | `/health` | ✅ readiness 응답 |
| POST | `/api/v1/generation/generate` | 🟡 외부 이미지 모델 의존 |
| POST | `/api/v1/generation/brand-kit` | 🟡 Pillow 임시 합성 |
| POST | `/api/v1/similarity/search` | ✅ DINOv2·FAISS 코드 연결 |
| POST | `/api/v1/embedding/extract` | ⚪ Backend/Frontend 호출처 없음 |

### 로고 생성

현재 코드 기준:

```text
Backend request
→ FastAPI generation route
→ prompt 생성
→ 외부 이미지 모델 호출
→ 최종 로고 합성
→ Base64 응답
```

현재 상태:

- 이미지 생성 코드 존재
- Backend contract 테스트 존재
- 외부 provider 실제 요청은 감사 과정에서 실행하지 않음
- 기본 Compose와 현재 provider key 전달 계약이 일치하지 않음

### 상표 유사도 분석

- DINOv2 embedding
- FAISS top-k 검색
- metadata 조합
- readiness 실패 시 503
- 실행 중인 AI health에서 `ready`, 7,423건 확인

### 미완성 또는 미사용

- Recraft client 없음
- 실제 제품·참고 이미지 기반 브랜드 키트 합성 없음
- similarity note는 Backend에서 버려져 Frontend까지 전달되지 않음
- `app/clients/llm_client.py`는 하드코딩 반환이며 호출처 없음
- pytest는 현재 로컬 Python 환경에 설치돼 있지 않아 미실행

---

## 9. 브랜드 키트 현재 구현과 목표

### 기능 정의

브랜드 키트는 새 로고를 생성하는 기능이 아니다.

```text
생성 완료된 원본 로고
→ 명함 또는 제품 썸네일에 적용
→ 실제 활용 이미지 생성
```

### 현재 구현 상태

| 항목 | 현재 상태 | 판정 |
|---|---|---|
| Frontend 생성 버튼 | 존재 | ✅ |
| Backend 생성 API | 존재 | ✅ |
| 비동기 job·Worker | 존재 | ✅ |
| `brand_kits` 저장 | 존재 | ✅ |
| FastAPI endpoint | 존재 | ✅ |
| 명함 임시 합성 | Pillow 기반 | 🟡 |
| 제품 썸네일 임시 합성 | Gradient 배경 기반 | 🟡 |
| Recraft 연동 | 없음 | 🔴 |
| 제품 사진 입력 | 없음 | 🔴 |
| 참고 이미지 입력 | 없음 | 🔴 |
| 명함 정보 입력 | 없음 | 🔴 |
| 생성 결과 화면 표시 | 없음 | 🔴 |
| 결과 다운로드 | 없음 | 🔴 |
| 단건 polling 계약 | Frontend·Backend 불일치 | 🔴 |

### 현재 실제 흐름

```text
Frontend 버튼
→ Backend BrandKitService
→ brand_kits: QUEUED
→ BrandKitWorker
→ BrandKitProcessor
→ FastAPI /api/v1/generation/brand-kit
→ Pillow 합성
→ Base64 반환
→ Backend 파일 저장
→ Frontend에는 상태만 표시
```

### 목표 구조

명함과 제품 썸네일 모두 같은 기본 구조를 사용한다.

```text
생성된 원본 로고
→ 브랜드 키트 종류 선택
→ 추가 정보·참고 이미지 입력
→ Recraft가 배경·디자인 연출 생성
→ 원본 로고와 정확한 정보를 후처리 합성
→ 미리보기
→ PNG/PDF/WebP 다운로드
```

#### 명함

```text
원본 로고
+ 이름·직책·연락처
+ 스타일 또는 참고 이미지
→ Recraft가 명함 배경·디자인 연출 생성
→ 내부 코드가 원본 로고와 실제 글자를 정확히 합성
→ PNG/PDF
```

Recraft 역할:

- 배경과 장식 요소
- 색상과 분위기
- 디자인 연출

내부 코드 역할:

- 로고 비율·색상 보존
- 이름·전화번호·이메일 정확한 출력
- 안전 영역과 인쇄 규격 적용
- PNG/PDF 생성

#### 제품 썸네일

```text
원본 로고
+ 제품 사진
+ 스타일 또는 참고 이미지
→ Recraft가 배경·조명·소품 생성
→ 내부 코드가 원본 제품과 로고를 합성
→ PNG/WebP
```

Recraft 역할:

- 광고 배경
- 조명과 그림자
- 소품과 분위기

내부 코드 역할:

- 실제 제품 형태 보존
- 원본 로고 변형 방지
- 최종 크기와 파일 형식 보장

### LLM 적용 여부

MVP에는 LLM이 필수가 아니다.

```text
제품 종류·스타일·색상 선택
→ 서버가 Recraft용 내부 prompt 생성
→ Recraft 호출
```

- 사용자 자연어 prompt: 선택 기능
- LLM: 자연어를 구체적인 디자인 설정으로 바꿀 때만 유용
- Recraft용 내부 prompt: 필수
- MVP 권장: LLM 없이 선택형 UI와 내부 prompt template 사용

---

## 10. Infra 현황

### 구현됨

- Backend, AI Server, Nginx, optional local MariaDB Compose 구성
- Nginx SPA 정적 파일 제공
- `/api/` Backend proxy
- AI `/health` healthcheck
- Backend/AI Dockerfile
- 수동 DB migration workflow

### 부분 구현 또는 불일치

- 루트 `docker-compose.yml`, `docker-compose.local.yml`, `docker-compose.dev.yml`의 환경변수와 역할이 다르다.
- `infra/docker/` 아래에 별도 Compose가 있어 공식 배포 기준이 불명확하다.
- 기본 Compose는 현재 이미지 provider의 필수 key를 전달하지 않는다.
- dev Compose는 여러 필수 환경변수가 없으면 빈 값으로 해석된다.
- AI CI는 pytest 실패를 `continue-on-error`로 허용한다.
- Backend·Frontend CI workflow는 없다.

---

## 11. API 계약 상태

### 실제 코드끼리 대체로 일치

- 인증·토큰·내 정보
- 온보딩
- CI/BI 프로젝트
- 로고 생성·polling·후보·선택
- 상표 분석·polling·matches
- 핀·다운로드
- 일부 관리자 API

### 문서와 실제 구현이 다름

- 문서: 통합 `/projects`
- 실제: `/ci-projects`, `/bi-projects`
- 문서의 project 응답은 중첩 구조, 실제 DTO는 별도 flat 구조
- 문서의 logo edit API는 실제 구현 없음
- 문서의 candidate save API는 실제 구현 없음
- 상표 분석 request와 score 범위가 문서와 실제 코드에서 다름

### Frontend·Backend 직접 불일치

- 브랜드 키트 Frontend GET 타입은 단건으로 가정한다.
- Backend `GET /brand-kits`는 목록을 반환한다.
- Frontend kit type에 과거 `BOTTLE` 표현이 남아 있고 Backend는 `THUMBNAIL`을 사용한다.

---

## 12. 미완성 항목 우선순위

### P0 — 핵심 흐름 차단

1. 공식 Compose의 이미지 provider key 전달 계약 불일치
2. 브랜드 키트 결과가 Frontend에 표시되지 않음

### P1 — 최종 프로젝트 완료 전에 필요

1. 공식 API 명세와 실제 코드 계약 통일
2. 로고 생성 실제 외부 E2E 검증
3. 상표 분석 실제 사용자 E2E 검증
4. 로고 편집 API·저장·적용 구현
5. 브랜드 키트 요청·조회 계약 수정
6. 브랜드 키트 Recraft 연동
7. 제품·참고 이미지 입력
8. 실제 운영 DB migration 상태 확인

### P2 — 기능 품질과 운영 보완

1. 마이페이지 완료 프로젝트 실제 조회
2. 관리자 화면 실제 API 데이터 연결
3. 설문 상세 데이터 저장
4. AI CI 실패 gate 적용
5. 실제 progress 제공
6. 이미지 provider 비용·모델·prompt version 기록
7. timeout·retry·fallback 표준화

### P3 — 후속 개선

1. 중복·미사용 API client 정리
2. dead Service·Repository 후보 정리
3. 자연어 브랜드 키트 prompt와 LLM 보정
4. 다중 Backend scheduler 분산 락
5. 관리자 통계 query 최적화

---

## 13. 권장 구현 순서

각 Phase는 독립적으로 검증 가능한 작은 commit 단위를 기준으로 한다.

### Phase A — 공식 실행 기준 확정

- 공식 Compose 파일 지정
- Backend·AI·DB 환경변수 계약 통일
- 이미지 provider key 주입
- `docker compose config`와 health 검증

### Phase B — 기존 핵심 E2E

- Fake login
- 온보딩
- CI 또는 BI 프로젝트 생성
- 로고 후보 4개 생성
- 후보 선택
- 상표 분석
- 결과 표시

### Phase C — API 명세 정리

- 실제 Controller·DTO 기준 API 표 작성
- `/ci-projects`, `/bi-projects` 정책 확정
- 낡은 `/projects`, edit 계약 분리
- Postman collection 갱신

### Phase D — 브랜드 키트 계약·화면 기반

- `BUSINESS_CARD`, `PRODUCT_THUMBNAIL` 명칭 확정
- request/response DTO 분리
- 단건 job 조회 endpoint 연결
- 현재 Pillow 결과부터 Frontend에 표시
- PNG 다운로드

### Phase E — 제품 썸네일 Recraft

- 제품 사진·참고 이미지 입력
- Recraft editing/background pipeline
- 원본 제품·로고 후처리 합성
- 여러 시안·재생성·다운로드

### Phase F — 명함 Recraft

- 명함 정보 입력
- Recraft 배경·디자인 연출
- 정확한 로고·텍스트 후처리 합성
- PNG/PDF 출력

### Phase G — 미완성 화면 제거

- 로고 편집 구현 또는 범위 제외 결정
- 마이페이지 완료 프로젝트 실제 연결
- 관리자 표·차트 실제 연결
- 설문 상세 저장

### Phase H — DB·운영 검증

- 운영 DB read-only schema 확인
- Flyway history와 V11/V20/V22 확인
- 데이터 보존 migration 계획
- CI test gate 정리

---

## 14. 팀장 확인이 필요한 결정

1. 공식 실행·배포 Compose 파일은 무엇인가?
2. 로고 편집을 최종 발표 범위에 포함할 것인가?
3. 브랜드 키트 제품 사진을 필수 입력으로 받을 것인가?
4. 참고 이미지 업로드를 MVP에 포함할 것인가?
5. 명함과 제품 썸네일에서 한 번에 몇 개 시안을 만들 것인가?
6. 브랜드 키트 PDF 다운로드를 MVP에 포함할 것인가?
7. 자연어 prompt와 LLM 보정을 MVP에 포함할 것인가?
8. Recraft 생성 비용을 사용자 credit에서 차감할 것인가?
9. 마이페이지·관리자 화면을 실제 운영 기능으로 완성할 것인가?
10. 운영 DB 확인을 누가 어떤 권한으로 수행할 것인가?

---

## 15. 검증 근거

| 검증 | 결과 |
|---|---|
| Backend test | 33개 실행, failures 0, errors 0, skipped 1 |
| Backend package | 성공 |
| Frontend TypeScript check | 성공 |
| Frontend production build | 성공, 1,795 modules |
| AI health | HTTP 200, `ready` |
| AI dataset | embedding·metadata 7,423건 |
| AI brand-kit endpoint | 1063×591 preliminary 이미지 반환 확인 |
| AI pytest | 현재 Python 환경에 pytest가 없어 미실행 |
| Compose config | root/local/dev 문법 검증 통과 |
| Backend 인증 probe | 비로그인 `/api/v1/me`가 예상대로 401 반환 |
| Frontend HTTP | Nginx를 통해 HTTP 200 확인 |

### 검증 해석 주의

- 테스트 성공은 외부 OAuth, 실제 이미지 provider, 운영 DB까지 포함한 전체 기능 완료를 의미하지 않는다.
- Backend 테스트에는 시작 시 untracked였던 `CreditFreeFlowTest.java`의 테스트 2개가 포함됐다.
- AI pytest는 dependency 설치 금지 조건으로 설치하지 않았다.

---

## 16. 확인된 사실과 미확인 사항

### 확인된 사실

- Backend·Frontend 핵심 코드가 build된다.
- 인증부터 생성·분석까지 코드 호출 경로가 존재한다.
- AI similarity readiness가 현재 실행 환경에서 ready다.
- 브랜드 키트 Backend job과 FastAPI endpoint가 존재한다.
- 브랜드 키트는 현재 Recraft가 아니라 Pillow 임시 합성이다.
- 일부 Frontend 화면은 고정 데이터다.
- API 문서와 실제 구현이 다르다.

### 추가 확인 필요

- 실제 Google/Kakao OAuth 성공
- 실제 이미지 provider logo generation
- 실제 MariaDB를 포함한 사용자 E2E
- 운영 DB schema와 Flyway history
- 운영 secrets와 공식 배포 구성
- AI pytest 전체 결과
- Recraft 모델별 실제 합성 품질과 비용

---

## 17. 최종 결론

현재 프로젝트는 단순 화면 시안 수준은 아니며, 인증·프로젝트·로고 생성 job·상표 분석·핀·다운로드까지 주요 기반 코드가 구현돼 있다.

그러나 외부 이미지 모델과 운영 DB를 포함한 전체 E2E가 확정되지 않았고, 로고 편집·마이페이지·관리자·브랜드 키트에는 명확한 미완성 구간이 있다. 따라서 현재 상태는 **핵심 기반 구현 + 주요 기능 부분 완성**으로 보는 것이 적절하다.

다음 작업은 기능을 넓게 추가하기보다 다음 순서가 안전하다.

```text
공식 실행 구성 확정
→ 기존 로고 생성·상표 분석 E2E
→ API 계약 정리
→ 브랜드 키트 결과 표시
→ Recraft 연동
→ 남은 고정 화면 제거
→ 운영 DB·CI 검증
```
