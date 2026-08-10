# 백엔드 로고 후보 조회 명세

## 1. 문제 요약

같은 프로젝트에서 로고를 다시 생성하면 생성 시도마다 `logo_generations` 행과 후보 4개가 새로 저장된다.

현재 `GET /api/v1/projects/{projectId}/logo-candidates`는 프로젝트 ID만 조건으로 사용한다. 따라서 해당 프로젝트의 최신 생성 결과 4개가 아니라 과거 생성 결과까지 모두 반환한다.

프론트엔드는 로고 생성 완료 후 후보가 정확히 4개인지 검사한다. 같은 프로젝트에서 2회 이상 생성하면 8개 이상이 반환되므로 다음 오류가 표시된다.

> 로고 후보를 4개 불러오지 못했어요.

## 2. 확인된 현재 동작

- 프론트의 `조건을 바꿔 다시 만들기`는 기존 프로젝트 ID를 유지한 채 새 `Idempotency-Key`로 생성 요청을 보낸다.
- 백엔드는 프로젝트가 `GENERATING` 또는 `ANALYZING` 상태일 때만 중복 생성 요청을 막는다. 생성이 끝난 프로젝트는 다시 생성할 수 있다.
- 생성 1회마다 AI는 후보 4개를 정상 반환한다.
- 실제 로컬 DB에서도 하나의 프로젝트에 생성 6건과 후보 24건이 확인되었다.
- 따라서 AI가 후보를 3개 또는 4개 미만 생성한 문제가 아니라, 후보 조회 범위가 너무 넓은 문제다.

## 3. 현재 코드 위치

- 생성 요청: `frontend/src/App.tsx`의 `startLogoGeneration`
- 후보 조회: `frontend/src/lib/genmarkApi.ts`의 `projectsApi.getCandidates`
- 후보 개수 검증: `frontend/src/App.tsx`의 `candidates.length !== 4`
- 백엔드 후보 조회: `backend/src/main/java/com/genmark/ai/service/LogoGenerationService.java`의 `candidates`
- 후보 Repository: `backend/src/main/java/com/genmark/ai/repository/LogoCandidateRepository.java`

## 4. 요구사항

### 필수

1. 후보 조회는 특정 생성 작업(`generationId`)에 귀속되어야 한다.
2. 다른 생성 작업의 후보가 섞여 반환되면 안 된다.
3. 프로젝트 소유권 검증은 기존과 동일하게 유지한다.
4. 존재하지 않거나 다른 사용자의 `generationId`이면 404를 반환한다.
5. 성공한 생성 작업의 후보는 정확히 4개를 `candidate_order` 순서로 반환한다.

### 권장 API 계약

기존 프로젝트 단위 엔드포인트를 다음과 같이 생성 작업 단위로 확장한다.

```http
GET /api/v1/projects/{projectId}/logo-generations/{generationId}/logo-candidates
```

응답 예시:

```json
{
  "data": [
    {
      "id": "candidate-public-id-1",
      "order": 1,
      "storageKey": "logos/{generationId}/candidate-1.png",
      "mimeType": "image/png",
      "width": 1024,
      "height": 1024,
      "selected": false,
      "saved": false,
      "createdAt": "2026-08-10T12:00:00"
    }
  ]
}
```

`generationId`가 프로젝트에 속하고 현재 사용자 소유인지 먼저 확인한 뒤 후보를 조회해야 한다.

## 5. 대안

프론트 수정 없이 기존 URL을 유지해야 한다면, 백엔드가 프로젝트의 가장 최근 `SUCCEEDED` 생성 작업 1건만 선택하고 그 생성 작업의 후보 4개만 반환할 수 있다.

다만 재생성 직후 어떤 결과를 표시할지 명확하게 보장하려면 `generationId`를 API에 명시적으로 전달하는 방식을 권장한다.

## 6. 완료 조건

- 같은 프로젝트에서 로고를 2회 생성해도 후보 API 응답은 매번 4개다.
- 첫 번째 생성의 후보가 두 번째 생성 응답에 섞이지 않는다.
- 다른 프로젝트 또는 다른 사용자의 `generationId`로 조회하면 404다.
- 프론트의 `로고 후보를 4개 불러오지 못했어요.` 오류가 정상적인 재생성 흐름에서 발생하지 않는다.
- 백엔드 단위/통합 테스트에 다음 케이스가 포함된다.
  - 단일 생성 작업 조회
  - 동일 프로젝트 다중 생성 작업 조회
  - 다른 프로젝트의 생성 작업 조회
  - 소유권이 다른 생성 작업 조회
