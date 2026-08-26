# GenMark-AI (AI-powered Trademark & Logo Generation Platform)

GenMark-AI는 Generative AI(Recraft V4 Vector · FLUX.2-pro)와 Visual Similarity(DINOv2 + FAISS)를 활용해
**로고 생성 → 브라우저 편집 → 상표 유사도 검증 → 브랜드 자산 산출**까지 한 번에 진행하는 웹 플랫폼입니다.

---

## ✨ 주요 기능

| 기능 | 설명 |
|---|---|
| 로고 생성 (CI/BI) | 설문 기반 심볼 / 워드마크 / 혼합형 / 레터마크 생성 (SVG + PNG, `Idempotency-Key` 멱등 처리) |
| 로고 편집기 | 브라우저 SVG 편집 — 요소 선택·이동·색상·크기·회전·투명도·삭제, 원본 복원 |
| 상표 유사도 검증 | DINOv2 임베딩 + FAISS 코사인 검색으로 **KIPRIS 등록 상표**와 비교, 위험도 SAFE / MODERATE / CAUTION |
| 자체 로고 유사도 | 생성한 로고를 별도 벡터 저장소(`generation-data`)에 등록해 KIPRIS와 **통합 검색** (매치 출처 `KIPRIS`/`GENERATED` 구분) |
| 브랜드킷 | 명함(앞/뒷면 PNG·SVG·PDF) 및 제품 썸네일 자동 생성, 동일 스펙 재생성 방지(hash 기반 재사용) |
| 다운로드 | PNG + SVG ZIP 아카이브, **첫 다운로드 시 만족도 설문 게이팅**(서버 강제) |
| 마이페이지 | 찜 · 다운로드 · 브랜드킷 · 크레딧 · 설문 이력 관리 |
| 관리자 대시보드 | 가입/생성/다운로드 분석 차트(인쇄 리포트), 회원·생성물 관리, 유사도 벡터화·1:1 비교 도구 |

> 크레딧은 가입(+2) · 설문(+1) 시 지급되며, 현재 생성/다운로드는 무료로 제공됩니다(`CreditFreeFlowTest` 보장).

---

## 🏗️ Architecture Overview

```
[브라우저]
   │ HTTPS
[Nginx — pub 서버, SSL 종료]  ← frontend/dist 정적 서빙 (SPA fallback)
   │  내부망 프록시 (/api, /uploads)
[Spring Boot Backend :8081 — pri 서버]
   │  JPA                          │ REST (timeout 180s)
[MariaDB 10.11]              [FastAPI AI Server :8000]
  16 tables                     ├─ Recraft V4 Vector (로고 SVG 생성)
  Flyway SQL                    ├─ FLUX.2-pro (제품 썸네일 목업)
                                ├─ DINOv2-base + FAISS (유사도)
                                └─ Gemini / Solar Pro (매치 note)
```

| 서비스 | 기술 스택 | 포트 |
|---|---|---|
| frontend | React 19 + TypeScript + Vite (정적 빌드) | Nginx가 서빙 (80/443) |
| backend | Java 17 · Spring Boot 3.2 · Spring Data JPA · Security(JWT) | 8081 (로컬 Postman 검증용 18080) |
| ai-server | Python 3.11 · FastAPI · PyTorch(DINOv2) · faiss-cpu | 8000 (`/docs` Swagger) |
| database | MariaDB 10.11 | 3306 (운영은 로컬바인드로 외부 노출 차단) |

핵심 설계:
- **비동기 작업 패턴** — 로고 생성 / 상표 분석 / 브랜드킷 모두 `QUEUED → RUNNING → SUCCEEDED/FAILED` 상태 머신 + `@Async` Worker, 프론트는 폴링
- **JWT 인증** — access(HS256, 1h) + opaque refresh(SHA-256 해시 저장, 매 사용 rotate), 소셜로그인(Google ID Token / Kakao Access Token) 검증 후 발급
- **자산 4계층 분리** — `/data/public_data`(PNG) / `/data/private_data`(SVG·PDF 등 비공개) / `trademark-data`(KIPRIS 원본, 읽기전용) / `generation-data`(자체 로고 벡터, 읽기·쓰기)

---

## 📁 Project Structure

```
GenMark_AI/
├── backend/                  # Spring Boot 백엔드
│   └── src/main/java/com/genmark/ai/
│       ├── web/controller/   #   /api/v1/** REST 컨트롤러 (auth · projects · admin ...)
│       ├── service/          #   도메인 서비스 + 비동기 Processor/Worker
│       ├── entity/ repository/
│       ├── oauth/  security/ #   소셜로그인 검증, JWT 필터
│       └── client/           #   FastAPI 호출 클라이언트 5종
├── ai-server/                # FastAPI AI 서버
│   └── app/
│       ├── api/routes/       #   generation · similarity · embedding · brand-kit · generation-vectors ...
│       ├── services/         #   로고생성 · 유사도 파이프라인 · note 생성
│       ├── models/  vector_store/
│   ├── data/                 #   KIPRIS FAISS 인덱스 + 상표 이미지 (읽기전용 마운트)
│   ├── generation-data/      #   자체 생성 로고 벡터 저장소 (rw 마운트)
│   └── tests/                #   pytest
├── frontend/                 # React SPA (고객 화면 App.tsx · 관리자 admin/AdminDashboard.tsx)
│   └── src/lib/genmarkApi.ts #   FE↔BE API 계약 단일 진입점
├── database/
│   ├── schema.sql            #   로컬 초기화용 전체 스냅샷
│   └── migration/            #   Flyway SQL V1~V33 (운영 기준)
├── infra/                    # nginx 설정 · Dockerfile.ai-server · 배포 스크립트
├── docs/                     # 요구사항 · API 명세 · 인수인계 문서
├── scripts/                  # 유틸리티 (화면 스펙 캡처 등)
└── docker-compose*.yml       # 운영(pub/pri 프로필) / 로컬 통합
```

---

## 🚀 Quick Start

### 0. 요구사항
- Docker + Docker Compose
- Node.js 20+ (프론트엔드 빌드)
- JDK 17, Maven / Python 3.11 (개별 실행 시)

### 1. 환경 변수 설정
```bash
cp .env.example .env
```
주요 항목: `DB_HOST/DB_NAME/DB_APP_USER/DB_APP_PASSWORD`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `KAKAO_REST_API_KEY`, `OPENROUTER_API_KEY`, `AI_SERVER_URL` (`.env.example` 주석 참고)

### 2. 프론트엔드 빌드 (Nginx가 dist를 서빙)
```bash
cd frontend && npm ci && npm run build && cd ..
```

### 3. 로컬 통합 실행 (권장: docker-compose.local.yml)
```bash
# DB는 .env의 외부 DB(project-db-campus.smhrd.com) 사용
docker compose -f docker-compose.local.yml up -d --build

# 일회용 로컬 DB가 필요하면 (포트 3307)
docker compose --profile local-db up -d local-db
```
로컬 프로필은 `AUTH_FAKE_PROVIDER_ENABLED=true`(fake OAuth)와 CORS(localhost:5173)가 활성화됩니다.

### 4. 접속 URL (로컬)
| 대상 | URL |
|---|---|
| Nginx Web Gateway | http://localhost |
| Spring Boot Backend Direct | http://localhost:8081 |
| FastAPI Swagger UI | http://localhost:8000/docs |
| 일회용 로컬 MariaDB | `localhost:3307` (genmark_user / genmark_pass) |

### 5. 개별 실행 (Docker 없이)
```bash
# backend  (기본 프로파일 local, 포트 8081)
cd backend && mvn spring-boot:run

# ai-server (포트 8000)
cd ai-server && pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# frontend (Vite dev 서버, /api·/uploads → localhost:8081 프록시)
cd frontend && npm run dev
```

---

## 🚢 Deployment (NCP 2서버 분리)

루트 `docker-compose.yml`은 프로필로 역할을 나눕니다.

| 서버 | 명령 | 구성 |
|---|---|---|
| **pub** (공개) | `docker compose --profile pub up -d` | Nginx만 — 443 SSL 종료 후 `/api`, `/uploads`를 pri 사설망으로 프록시 |
| **pri** (사설) | `docker compose --profile pri up -d` | backend + ai-server + MariaDB(로컬바인드) |

개별 재배포: `infra/scripts/deploy-backend.sh` · `infra/scripts/deploy-ai-server.sh`
업로드 데이터는 호스트 `/data/public_data|private_data/*` 구조로 영속화됩니다.

---

## 🗄️ Database

- **런타임 Flyway는 비활성**(`spring.flyway.enabled=false`)이며, Hibernate는 `ddl-auto=validate`로 스키마 검증만 수행합니다.
- **로컬**: `database/schema.sql`(전체 스냅샷) + `seed.sql`이 local-db 초기화에 주입됩니다.
- **운영**: `database/migration/V1~V33`을 순서대로 적용합니다. GitHub Actions **db-migrate.yml**(수동 dispatch, environment 승인)이 Flyway 12 컨테이너로 안전하게 밀어줍니다.
- 최근 마이그레이션: `V32__create_generated_logo_vectors.sql`(자체 로고 벡터 bookkeeping), `V33__add_source_to_trademark_matches.sql`(매치 출처 `KIPRIS`/`GENERATED`).

주요 테이블: `members`, `ci_project/bi_project`, `logo_generations`(CI·BI XOR FK, 멱등키), `logo_candidates`, `trademark_analyses/matches`, `brand_kits/business_card_infos`, `logo_downloads`, `credit_histories`, `member_surveys/onboardings`, `generated_logo_vectors`, `admins` 등 16개 — 상세 해설은 `docs/database-table-guide-easy.md`.

---

## 🔄 CI / 테스트

| 워크플로 | 내용 |
|---|---|
| `.github/workflows/db-migrate.yml` | 운영 DB Flyway 마이그레이트 게이트 (수동 실행) |
| `.github/workflows/ai-server-ci.yml` | push/PR 시 ai-server pytest |

```bash
cd backend    && mvn test      # 서비스/클라이언트/컨트롤러 단위 테스트 (Mockito 기반)
cd ai-server  && pytest
cd frontend   && npm run build # tsc 타입검사 + Vite 빌드
```

---

## 📚 문서

- `docs/ai-team-trademark-similarity-requirements.md` — 상표 유사도 AI 요구사항 정의서
- `docs/api/ai-api.md` — FastAPI AI 서버 API 명세
- `docs/frontend-backend-handoff.md` — FE↔BE REST API 계약
- `docs/2026-08-16_GENMARK_CONNECTION_AI_DB_HANDOFF.md` — 화면·API·DB·AI 전체 연결 점검
- `docs/postman/` — Postman 컬렉션 + Newman 검증 결과
- `docs/database-table-guide-easy.md` — DB 테이블 입문 해설

---

## 🧰 Portable Codex Setup

저장소의 Codex 전역 지침과 스킬을 다른 PC에서 재현하려면:
```powershell
pwsh -NoProfile -File .\scripts\setup-codex.ps1
```
자세한 범위·백업·전역 설정 교체 방법은 [`docs/codex-portable.md`](docs/codex-portable.md) 참고.
