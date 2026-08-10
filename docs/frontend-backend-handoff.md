# GenMark AI Frontend ↔ Backend 인수인계 명세

## 1. 범위와 현재 상태

- 이 문서는 현재 `backend` 브랜치에 구현된 REST API를 프론트 팀이 연결하기 위한 계약이다.
- 프론트 화면과 스타일은 이 작업에서 수정하지 않았다.
- 개발 Backend 주소는 `http://localhost:18080`이다. 직접 확인용으로 `http://localhost:8081`도 열려 있다.
- 공통 API prefix는 `/api/v1`이다.
- Backend는 `project-db-campus.smhrd.com:3308 / cgi_25IS_GA3_p3_2`를 사용한다.
- 대상 DB에는 V5~V7 테이블이 적용돼 있다. 기존 `members`는 보존됐다.
- 현재 DB 서버는 TLS를 지원하지 않아 개발 환경에서만 `sslMode=disable`을 사용한다.

## 2. 프론트 구현 우선순위

1. 로그인 응답의 `onboardingCompleted`로 최초 진입 화면을 결정한다.
2. 온보딩 완료 버튼에서 `PUT /api/v1/me/onboarding`을 반드시 호출한다.
3. 프로젝트 단계별 입력을 프로젝트 API로 저장한다.
4. 로고 생성 요청 후 상태를 polling 한다.
5. 후보 4개를 조회하고 하나를 선택한다.
6. 선택 후보로 상표 분석을 시작하고 상태와 matches를 polling 한다.

브라우저 `localStorage`의 온보딩 값은 화면 임시 상태로만 사용할 수 있다. 로그인 이후 진실의 원천(source of truth)은 Backend 응답의 `onboardingCompleted`와 온보딩 API다.

## 3. 공통 규칙

### 인증

- `/api/v1/auth/**`를 제외한 `/api/v1/**`는 JWT가 필요하다.
- 요청 헤더: `Authorization: Bearer <accessToken>`
- access token 만료 시 refresh API를 한 번 호출하고 원 요청을 한 번만 재시도한다.
- refresh 실패 시 token을 삭제하고 로그인 화면으로 이동한다.

### 성공 응답

```json
{
  "data": {},
  "meta": {
    "requestId": "req_...",
    "timestamp": "2026-08-07T05:00:00Z"
  }
}
```

### 오류 응답

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청값을 확인해주세요.",
    "details": [],
    "requestId": "req_..."
  }
}
```

주요 HTTP/code:

- `400 PROVIDER_NOT_SUPPORTED`
- `401 AUTH_REQUIRED | TOKEN_EXPIRED | OAUTH_VERIFICATION_FAILED`
- `404 RESOURCE_NOT_FOUND`
- `409 RESOURCE_CONFLICT`
- `422 VALIDATION_ERROR | ONBOARDING_DETAILS_REQUIRED`
- `502 AI_UNAVAILABLE | AI_INVALID_RESPONSE | AI_INCOMPLETE_RESULT`
- `500 STORAGE_ERROR | INTERNAL_ERROR`

오류 문의 시 화면에 `requestId`를 함께 남긴다.

## 4. 인증 API

### `POST /api/v1/auth/login`

요청:

```json
{
  "provider": "google",
  "idToken": "GOOGLE_ID_TOKEN",
  "redirectUri": "http://localhost"
}
```

- `google`: Google ID token(`credential`)을 전달한다.
- `kakao`: 현재 Backend 계약은 Kakao access token을 `idToken` 필드에 전달한다.
- `fake`: 로컬 개발 전용이다. 운영 UI에서 사용하지 않는다.

응답 `data`:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 3600,
  "user": {
    "id": "11",
    "email": "user@example.com",
    "name": "사용자",
    "provider": "google",
    "isFirstLogin": false,
    "onboardingCompleted": false
  },
  "resumeProjectId": null
}
```

화면 분기:

- `onboardingCompleted === false` → 온보딩
- `onboardingCompleted === true` → 홈
- `isFirstLogin`은 신규 회원 생성 여부만 뜻한다. 온보딩 분기에 사용하지 않는다.

### `POST /api/v1/auth/refresh`

```json
{ "refreshToken": "..." }
```

응답은 새 `accessToken`, 새 `refreshToken`, `expiresIn`이다. refresh token은 rotation되므로 기존 값을 즉시 교체한다.

### `POST /api/v1/auth/logout`

```json
{ "refreshToken": "..." }
```

- 성공: `204 No Content`
- 성공 여부와 관계없이 프론트 token 저장소를 비운다.

### `GET /api/v1/me`

현재 사용자와 `onboardingCompleted`를 다시 확인한다.

## 5. 온보딩 API

### `GET /api/v1/me/onboarding`

미완료 응답 예시:

```json
{
  "completed": false,
  "usage": [],
  "audience": null,
  "detailsDecision": null,
  "initialProjectId": null,
  "completedAt": null,
  "schemaVersion": 1
}
```

### `PUT /api/v1/me/onboarding`

UI 매핑 권장값:

- 사용처 복수 선택: `online | social | offline`
- 방문 대상 단일 선택: `company | owner | hobby | sidejob`

상세 제출:

```json
{
  "usage": ["online", "social"],
  "audience": "company",
  "detailsDecision": "SUBMITTED",
  "initialProject": {
    "brandType": "CI",
    "industry": "COSMETICS",
    "brandName": "GenMark",
    "companyName": "GenMark AI",
    "companyMotto": "Create safely",
    "brandValues": ["cleanBeauty", "scientific"],
    "brandValuesText": "신뢰할 수 있는 클린 뷰티",
    "targetAge": "20-30",
    "tone": "minimal",
    "colorMode": "MANUAL",
    "colors": ["#7B5CDF"],
    "logoStyle": "combination",
    "includeBrandName": true,
    "additionalRequirements": "심볼은 단순하게"
  }
}
```

상세 건너뛰기:

```json
{
  "usage": ["online"],
  "audience": "hobby",
  "detailsDecision": "SKIPPED"
}
```

규칙:

- `usage`는 1개 이상, `audience`는 필수다.
- `SUBMITTED`면 `initialProject`가 필수다.
- `SKIPPED`면 `initialProject`를 보내면 안 된다.
- 완료 API는 멱등이다. 이미 완료된 사용자가 다시 호출하면 기존 결과를 반환한다.
- 저장 성공 응답을 받은 후에만 화면의 완료 상태를 변경한다.

## 6. 프로젝트 API

### 프로젝트 입력 타입

모든 필드는 부분 수정에서 선택 입력이다.

```ts
type ProjectInput = {
  brandType?: string
  industry?: string
  brandName?: string
  companyName?: string
  companyMotto?: string
  brandValues?: string[]
  brandValuesText?: string
  targetAge?: string
  tone?: string
  colorMode?: string
  colors?: string[]
  logoStyle?: string
  includeBrandName?: boolean
  additionalRequirements?: string
}
```

### Endpoint

- `POST /api/v1/projects` → 프로젝트 생성, `201`
- `GET /api/v1/projects/{projectId}` → 소유 프로젝트 조회
- `PATCH /api/v1/projects/{projectId}` → 임의 필드 부분 수정
- `PUT /api/v1/projects/{projectId}/brand-brief`
- `PUT /api/v1/projects/{projectId}/tone`
- `PUT /api/v1/projects/{projectId}/logo-style`
- `PUT /api/v1/projects/{projectId}/final-review`

단계별 PUT은 동일한 `ProjectInput` 계약을 사용한다. 응답의 `data.id`가 URL에 사용할 public UUID다.

프로젝트 상태:

```text
DRAFT → BRIEF_READY → GENERATING → RESULT_READY → ANALYZING → COMPLETED
```

## 7. 로고 생성 API

### `POST /api/v1/projects/{projectId}/logo-generations`

필수 헤더:

```text
Idempotency-Key: 프론트가 생성한 UUID
```

- 성공: `202 Accepted`
- 같은 프로젝트와 같은 key를 재전송하면 기존 작업을 반환한다.
- 호출 즉시 `QUEUED`, 비동기로 `RUNNING → SUCCEEDED | FAILED`가 된다.
- 실제 NVIDIA FLUX 호출이 4회 발생할 수 있으므로 중복 클릭을 막는다.

### Polling

- `GET /api/v1/projects/{projectId}/logo-generations/{generationId}`
- 권장 주기: 1~2초
- `SUCCEEDED | FAILED`에서 중단
- `FAILED`면 `errorCode`, `errorMessage`를 표시한다.

### 후보

- `GET /api/v1/projects/{projectId}/logo-generations/{generationId}/logo-candidates`
- 성공 작업은 후보가 정확히 4개다.
- `POST /api/v1/projects/{projectId}/logo-candidates/{candidateId}/select`

후보 응답:

```json
{
  "id": "candidate-uuid",
  "order": 1,
  "storageKey": "logos/generation-uuid/candidate-1.png",
  "mimeType": "image/png",
  "width": 1024,
  "height": 1024,
  "selected": false,
  "saved": false,
  "createdAt": "..."
}
```

### 현재 이미지 표시 제약

`storageKey`는 서버 내부 파일 키이며 브라우저용 URL이 아니다. `/uploads/**`는 인증/CORS 계약이 프론트 표시용으로 완성되지 않았다. 따라서 후보 이미지를 `<img>`로 표시하려면 Backend에 소유권 검증이 포함된 이미지 조회 endpoint 또는 서명 URL 계약을 추가해야 한다. 프론트에서 경로를 임의 조합하지 않는다.

## 8. 상표 분석 API

선행조건: 로고 생성 성공 후 후보 1개가 `selected=true`여야 한다.

- `POST /api/v1/projects/{projectId}/trademark-analyses` → `202`
- `GET /api/v1/projects/{projectId}/trademark-analyses/{analysisId}` → 상태 polling
- `GET /api/v1/projects/{projectId}/trademark-analyses/{analysisId}/matches` → 성공 후 3개 결과
- `GET /api/v1/projects/{projectId}/trademark-analyses/{analysisId}/matches/{rank}/image` → 실제 상표 이미지 binary

`matches`의 각 항목에는 인증 이미지 endpoint인 `imageUrl`이 포함된다. `imagePath`는 서버 내부 경로이므로 프론트에서 사용하지 않는다. 이미지 endpoint도 JWT 인증이 필요하므로 `<img src>`로 직접 호출하지 말고 Bearer token을 포함한 `fetch` → `Blob` → `URL.createObjectURL` 순서로 표시한다. 상세 구현은 `docs/frontend-trademark-image-api-handoff.md`를 따른다.

분석 상태:

```text
QUEUED → RUNNING → SUCCEEDED | FAILED
```

risk:

- `SAFE`
- `MODERATE`
- `CAUTION`

`disclaimer`는 결과 화면에 반드시 노출한다. 점수와 risk는 Backend 응답을 그대로 사용하고 프론트에서 재계산하지 않는다.

## 9. 화면별 연결 체크리스트

| 화면/이벤트 | API | 성공 처리 |
|---|---|---|
| OAuth 완료 | `POST /auth/login` | token 저장, `onboardingCompleted` 분기 |
| 앱 재진입 | `POST /auth/refresh` → `GET /me` | 세션 복원 |
| 온보딩 진입 | `GET /me/onboarding` | 기존 완료 여부 확인 |
| 온보딩 완료 | `PUT /me/onboarding` | 성공 후 다음 화면 이동 |
| 프로젝트 각 단계 다음 | `PATCH` 또는 단계별 `PUT` | 응답으로 로컬 상태 동기화 |
| 생성 버튼 | `POST .../logo-generations` | `generationId` 저장, polling 시작 |
| 생성 완료 | `GET .../logo-generations/{generationId}/logo-candidates` | 해당 생성 작업의 후보 4개 검증 |
| 후보 선택 | `POST .../select` | 선택 상태 갱신 |
| 분석 버튼 | `POST .../trademark-analyses` | `analysisId` 저장, polling 시작 |
| 분석 완료 | `GET analysis` + `GET matches` | 요약·3개 matches·면책문 표시 |

## 10. 프론트 전달 시 함께 공유할 파일

- `docs/frontend-backend-handoff.md`
- `docs/postman/GenMark-core.postman_collection.json`
- `docs/postman/GenMark-core.postman_environment.json`
- `docs/postman/GenMark-ai-manual.postman_collection.json`
- `docs/frontend-trademark-image-api-handoff.md`

## 11. 알려진 제한

- 프론트는 현재 온보딩/프로젝트/생성/분석 API에 연결돼 있지 않다.
- 상표 이미지 API는 Docker에서 `./ai-server/data/trademarks`를 Backend에 read-only로 mount해야 한다.
- similarity 서버에 FAISS index와 상표 metadata가 없으면 분석 결과가 정상 생성되지 않는다.
- 실제 로고 생성은 NVIDIA 외부 API 비용과 지연이 발생한다.
- 운영 전 DB TLS 또는 암호화 터널 적용이 필요하다.
