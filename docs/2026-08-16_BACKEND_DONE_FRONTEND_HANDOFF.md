# GenMark 백엔드 완료 사항 및 프론트엔드 작업 명세

- 작성일: 2026-08-16
- 기준 브랜치: `develop`
- 기준 커밋: `9094b89479da39fd649f6a7a0db528086a55625a` 이후 로컬 변경
- 목적: 백엔드가 보완한 API/DB 계약을 프론트엔드가 빠짐없이 연결하기 위한 인수인계

## 1. 한눈에 보는 결론

백엔드에서 다음 작업을 완료했다.

1. 화면에 있던 설문 답변을 실제 DB에 저장한다.
2. 화면 문구와 다르던 설문 보상을 `2크레딧`에서 `1크레딧`으로 맞췄다.
3. 색상을 4개에서 2개로 줄일 때 과거 색상이 DB에 남는 문제를 해결했다.
4. 업종, 연령, 로고 스타일, HEX 색상 값이 잘못되면 AI 호출 전에 차단한다.
5. AI 유사상표 응답의 `note`를 버리지 않고 DB와 API 응답까지 전달한다.
6. AI 브랜드킷 응답의 `preliminary`, `warnings`를 DB와 API 응답까지 전달한다.
7. 신규 DB 컬럼을 위한 V26/V27 SQL과 신규 DB용 `database/schema.sql`을 갱신했다.

프론트엔드는 아래 네 묶음을 작업하면 된다.

- 설문 제출 시 실제 입력값 전송
- 색상 전체 교체 요청에 `paletteReplace: true` 전송
- 유사상표 `note` 표시
- 브랜드킷 임시 결과/경고 표시

## 2. 백엔드 완료 내용

| 구분 | 변경 내용 | 저장 위치 |
|---|---|---|
| 설문 | `rating`, `improvements`, `comment` 수신 및 저장 | `member_surveys` |
| 설문 보상 | 화면 안내와 동일하게 1크레딧 지급 | `members`, `credit_histories` |
| 색상 | 전체 교체와 기존 부분 수정 동작을 구분 | `ci_project`, `bi_project` |
| 입력 검증 | 업종/연령/스타일/색상 형식 검사, 생성 직전 재검사 | API 422 응답 |
| 유사상표 | AI의 `matches[].note` 저장 및 반환 | `trademark_matches.note` |
| 브랜드킷 | AI의 `preliminary`, `warnings` 저장 및 반환 | `brand_kits` |

기존 앱과의 호환도 유지했다.

- 설문 POST에 본문이 없는 구버전 요청도 계속 성공한다. 단, 새 화면은 반드시 답변 본문을 보내야 한다.
- `paletteReplace`를 생략하거나 `false`로 보내면 예전처럼 전달된 색상 슬롯만 수정한다.
- 구버전 AI가 `preliminary`와 `warnings`를 생략하면 각각 `false`, `[]`로 처리한다.
- 유사상표 `note`가 없어도 분석은 실패하지 않고 `null`로 반환한다.

## 3. 프론트 작업 1 — 설문 답변 전송

### 3.1 API 계약

```http
POST /api/v1/me/survey
Content-Type: application/json
Authorization: Bearer {accessToken}
```

```json
{
  "rating": 5,
  "improvements": ["로고 생성·재생성", "유사 상표 확인"],
  "comment": "결과 비교가 더 쉬웠으면 좋겠어요."
}
```

필드 규칙:

| 필드 | 필수 | 허용값 |
|---|---:|---|
| `rating` | 예 | `1` 또는 `5` |
| `improvements` | 아니오 | 최대 6개, 아래 정해진 문구만 허용 |
| `comment` | 아니오 | 최대 500자 |

`improvements` 허용값:

```ts
type SurveyImprovement =
  | '로고 생성·재생성'
  | '브랜드 맞춤 로고'
  | '로고 수정'
  | '유사 상표 확인'
  | '로고 저장·활용'
  | '기타'

type SurveySubmitInput = {
  rating: 1 | 5
  improvements: SurveyImprovement[]
  comment?: string
}
```

### 3.2 수정 위치

`frontend/src/lib/genmarkApi.ts`

```ts
submitSurvey: (input: SurveySubmitInput) => apiRequest<SurveyStatus>('/me/survey', {
  method: 'POST',
  body: JSON.stringify(input),
})
```

`frontend/src/App.tsx`의 `submitSurveyResponse`:

```ts
const result = await meApi.submitSurvey({
  rating: surveyRating as 1 | 5,
  improvements: surveyImprovements as SurveyImprovement[],
  comment: surveyComment.trim() || undefined,
})
```

현재 화면은 값을 상태에 잘 담고 있지만 `meApi.submitSurvey()`를 무본문으로 호출해 답변이 유실된다. 이 호출만 위 계약대로 연결하면 된다.

성공 응답은 기존과 같다.

```json
{
  "data": {
    "completed": true,
    "creditBalance": 3
  },
  "meta": {}
}
```

`creditBalance`는 서버의 최종 잔액이므로 프론트에서 `+1` 계산하지 말고 응답값을 그대로 사용한다.

## 4. 프론트 작업 2 — 색상 전체 교체

### 4.1 왜 필요한가

기존 요청은 `undefined` 필드를 JSON에서 생략한다. 예를 들어 기존 DB에 4색이 있는데 프론트가 2색만 보내면 `color3`, `color4`가 생략되어 예전 값이 남았다.

백엔드에 `paletteReplace` 계약을 추가했다.

- 생략 또는 `false`: 전달한 색상 슬롯만 수정하는 기존 부분 수정
- `true`: 4개 슬롯을 요청값으로 완전히 교체
- `colorMode: "TONE"`와 `paletteReplace: true`: 추천 팔레트 HEX를 그대로 전체 교체 저장
- `colorMode: "MANUAL"`와 `paletteReplace: true`: 최소 한 개의 HEX 색상이 필요

`TONE`은 “추천 팔레트에서 선택했다”는 출처이고, 선택한 색상이 없다는 뜻이 아니다.
추천 팔레트의 HEX도 DB의 `color1~4`에 저장하며 AI 요청에는 다음처럼 함께 전달한다.
기존 프론트와의 호환을 위해 `colorMode: "TONE"` 요청은 `paletteReplace`가 없어도
전달된 4개 색상 슬롯 전체를 교체하므로 과거 MANUAL 색상이 뒤에 남지 않는다.

```json
{
  "tone": "friendly",
  "color_mode": "ai",
  "color_manual": ["#F4A261", "#E9C46A"]
}
```

AI는 `color_manual` 값이 있으면 추천/직접 지정 구분과 관계없이 해당 색상을 우선 사용하고,
HEX가 없을 때만 `tone`의 기본 팔레트를 사용한다.

### 4.2 타입과 요청 변환 수정

`frontend/src/lib/genmarkApi.ts`

```ts
export type ProjectInput = {
  // 기존 필드 유지
  paletteReplace?: boolean
}
```

색상 전체 교체 시에는 빈 슬롯을 `null`로 명시해야 한다.

```ts
const colorFields = (colors: string[] | undefined, paletteReplace = false) => ({
  color1: paletteReplace ? colors?.[0] ?? null : colors?.[0],
  color2: paletteReplace ? colors?.[1] ?? null : colors?.[1],
  color3: paletteReplace ? colors?.[2] ?? null : colors?.[2],
  color4: paletteReplace ? colors?.[3] ?? null : colors?.[3],
  paletteReplace,
})
```

`toCiProjectRequest`, `toBiProjectRequest` 모두 다음처럼 호출한다.

```ts
...colorFields(input.colors, input.paletteReplace)
```

### 4.3 화면별 호출 규칙

톤/직접 색상 선택 화면에서 사용자가 최종 팔레트를 저장할 때:

```ts
input.colors = getSelectedColors()
input.paletteReplace = true
```

로고 편집기의 현재 코드는 다음처럼 한 색만 보내고 있다.

```ts
colors: [editorColor]
```

이 값에 곧바로 `paletteReplace: true`를 붙이면 나머지 색상을 의도치 않게 지운다. 편집기에서는 기존 팔레트를 복사해 수정한 슬롯만 바꾼 뒤 전체 팔레트를 보내야 한다.

```ts
const nextColors = [...getSelectedColors()]
nextColors[0] = editorColor

await projectsApi.patch(projectId, {
  brandType: brandKind === 'bi' ? 'BI' : 'CI',
  colorMode: 'MANUAL',
  colors: nextColors,
  paletteReplace: true,
})
```

색상은 반드시 `#RRGGBB` 형식으로 보낸다. 예: `#7B5CDF`.

## 5. 프론트 작업 3 — 유사상표 note 표시

### 5.1 타입 수정

`frontend/src/lib/genmarkApi.ts`

```ts
export type TrademarkMatch = {
  rank: number
  applicationNumber: string
  name: string
  category: string
  similarity: number
  imagePath: string | null
  imageUrl?: string
  note?: string | null
}
```

응답 예시:

```json
{
  "rank": 1,
  "applicationNumber": "4020240012345",
  "name": "SAMPLE MARK",
  "category": "제42류",
  "similarity": 72,
  "imagePath": "trademarks/sample.png",
  "imageUrl": "/api/v1/projects/.../matches/1/image",
  "note": "원형 심볼의 외곽선과 중앙 배치가 유사합니다."
}
```

`frontend/src/App.tsx`의 상표 결과 목록에서 `note`가 있을 때만 보조 설명으로 표시한다.

```tsx
{match.note && <p className="trademark-match-note">{match.note}</p>}
```

`note`가 `null`이어도 기존 이름/분류/출원번호/유사도 표시와 분석 흐름은 그대로 유지한다.

## 6. 프론트 작업 4 — 브랜드킷 임시 결과/경고 표시

### 6.1 타입 수정

`frontend/src/lib/genmarkApi.ts`

```ts
export type BrandKit = {
  // 기존 필드 유지
  preliminary: boolean
  warnings: string[]
}
```

응답 예시:

```json
{
  "id": "kit-id",
  "candidateId": "candidate-id",
  "projectId": "project-id",
  "kitType": "THUMBNAIL",
  "status": "SUCCEEDED",
  "storageKey": "logos/brand-kits/kit-id/1.png",
  "storageKeys": ["logos/brand-kits/kit-id/1.png"],
  "preliminary": true,
  "warnings": ["AI 연출 배경 미적용 — 톤 기반 그라데이션으로 대체했습니다."],
  "errorCode": null,
  "errorMessage": null
}
```

### 6.2 화면 규칙

- `status === 'SUCCEEDED' && preliminary === false`: 일반 완성 결과
- `status === 'SUCCEEDED' && preliminary === true`: 결과 이미지는 보여주되 `임시 결과` 배지 표시
- `warnings.length > 0`: 이미지 아래에 경고 목록 표시
- `preliminary === true`여도 `FAILED`가 아니므로 미리보기와 다운로드를 막지 않는다.
- `FAILED` 처리 기준은 기존 `status/errorCode/errorMessage`를 그대로 사용한다.

권장 UI 예시:

```tsx
{completedBrandKit.preliminary && (
  <span className="brand-kit-preliminary-badge">임시 결과</span>
)}

{completedBrandKit.warnings.length > 0 && (
  <ul className="brand-kit-warnings">
    {completedBrandKit.warnings.map((warning) => <li key={warning}>{warning}</li>)}
  </ul>
)}
```

## 7. 입력 검증 계약

프로젝트 생성/수정과 로고 생성 직전에 다음 값을 검사한다.

| 값 | 허용값 |
|---|---|
| `industry` | `COSMETICS`, `FASHION`, `FOOD`, `HEALTH_WELLNESS`, `TECH`, `EDUCATION`, `PET`, `OTHER` |
| `targetAge` | `10~20`, `30~40`, `50~60`, `전 연령층` |
| `logoStyle` | `symbol`, `wordmark`, `combination`, `lettermark` |
| `colorMode` | `TONE`, `MANUAL` |
| `color1`~`color4` | `#RRGGBB` |

검증 실패는 HTTP 422로 내려간다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청값을 확인해 주세요.",
    "details": [
      { "field": "color1", "reason": "must match ..." }
    ],
    "requestId": "..."
  }
}
```

로고 생성 직전 저장 데이터 검증 실패는 `details`가 비어 있고 `message`에 사용자용 사유가 들어갈 수 있다. 프론트는 우선 `error.message`를 보여주고, 필요하면 `error.details`의 필드별 사유를 보조 표시한다.

## 8. DB 변경 및 적용 순서

### V26 — 설문 답변 저장

`member_surveys`에 추가:

- `rating TINYINT NULL`
- `improvements_json TEXT NULL`
- `comment VARCHAR(500) NULL`
- `survey_version SMALLINT NOT NULL DEFAULT 1`

### V27 — AI 결과 메타데이터 저장

`trademark_matches`에 추가:

- `note TEXT NULL`

`brand_kits`에 추가:

- `preliminary BOOLEAN NOT NULL DEFAULT FALSE`
- `warnings_json TEXT NULL`

중요: 현재 local/prod 설정은 `spring.flyway.enabled=false`, `ddl-auto=validate`다. 따라서 백엔드 Docker 이미지만 먼저 재빌드하면 기존 DB에 컬럼이 없어 기동 검증이 실패한다.

기존 DB 적용 순서:

1. DB 백업 또는 스냅샷
2. `database/migration/V26__store_survey_answers.sql` 적용
3. `database/migration/V27__store_ai_result_metadata.sql` 적용
4. 백엔드 재빌드/재시작
5. `/actuator/health`와 설문/브랜드킷/유사상표 API 확인

신규 빈 DB는 갱신된 `database/schema.sql`을 사용한다.

## 9. 프론트 완료 기준

- [ ] 좋아요/싫어요, 개선항목, 추가 의견이 설문 POST 본문에 들어간다.
- [ ] 설문 완료 후 응답의 `creditBalance`를 화면 잔액으로 사용한다.
- [ ] 저장된 4색을 2색으로 변경한 뒤 재조회하면 정확히 2색만 남는다.
- [ ] 추천 팔레트를 선택하고 재조회하면 TONE과 선택한 HEX가 함께 남는다.
- [ ] 추천 팔레트로 생성할 때 AI 요청의 `color_manual`에 선택 HEX가 포함된다.
- [ ] 편집기에서 첫 색만 변경해도 나머지 팔레트는 보존된다.
- [ ] 잘못된 HEX/업종/연령/스타일에 대해 422 메시지를 표시한다.
- [ ] 유사상표 `note`가 있으면 표시하고, 없어도 화면이 깨지지 않는다.
- [ ] 브랜드킷 `preliminary`가 true이면 임시 결과 배지와 `warnings`를 표시한다.
- [ ] 임시 결과도 `SUCCEEDED`이면 미리보기/다운로드가 가능하다.
- [ ] 기존 브랜드킷 응답에 새 필드가 없다고 가정한 로컬 목업이 있다면 기본값 `false`, `[]`를 넣는다.

## 10. 권장 프론트 테스트

1. `meApi.submitSurvey` 요청 본문 직렬화 테스트
2. `colorFields`의 4색→2색 변환 테스트 (`color3`, `color4`가 `null`인지 확인)
3. 부분 수정 시 `paletteReplace` 생략 테스트
4. `TrademarkMatch.note` null/문자열 렌더링 테스트
5. `BrandKit.preliminary/warnings` 렌더링과 다운로드 버튼 유지 테스트

## 11. 백엔드 관련 파일

- `backend/src/main/java/com/genmark/ai/web/dto/survey/SurveySubmitRequest.java`
- `backend/src/main/java/com/genmark/ai/service/SurveyService.java`
- `backend/src/main/java/com/genmark/ai/web/dto/project/CiProjectUpsertRequest.java`
- `backend/src/main/java/com/genmark/ai/web/dto/project/BiProjectUpsertRequest.java`
- `backend/src/main/java/com/genmark/ai/service/LogoGenerationService.java`
- `backend/src/main/java/com/genmark/ai/service/TrademarkAnalysisProcessor.java`
- `backend/src/main/java/com/genmark/ai/service/BrandKitProcessor.java`
- `database/migration/V26__store_survey_answers.sql`
- `database/migration/V27__store_ai_result_metadata.sql`
