# 프론트엔드 인수인계 — 유사 상표 실제 이미지 표시

## 1. 작업 목적

상표 유사도 결과 화면의 보라색 임시 도형을 실제 KIPRIS 상표 이미지로 교체한다.

Backend는 다음을 구현했다.

- 분석 결과별 상표 이미지 URL 제공
- 로그인 사용자와 프로젝트·분석 소유권 검증
- 상표 원본 JPEG/PNG를 binary 응답으로 제공
- 안전한 인증 `imageUrl`을 제공하고, 기존 `imagePath`는 호환용 deprecated 필드로만 유지
- 경로 이탈(`..`), 없는 파일, 잘못된 이미지 차단

## 2. 반드시 지킬 규칙

- 모든 요청에는 `Authorization: Bearer <accessToken>`이 필요하다.
- `imagePath`는 현재 하위 호환 때문에 응답에 남아 있지만 deprecated된 서버 내부 경로다. 프론트에서 조합하거나 사용하지 않는다.
- 목록 응답의 `imageUrl`만 사용한다.
- `<img src={match.imageUrl}>`로 바로 표시하면 Bearer 토큰이 빠져 `401`이 발생한다.
- 먼저 `fetch`로 Blob을 받은 뒤 `URL.createObjectURL(blob)` 결과를 `<img>`에 넣는다.

## 3. 유사 상표 목록 조회

```http
GET /api/v1/projects/{projectId}/trademark-analyses/{analysisId}/matches
Authorization: Bearer <accessToken>
```

### 성공 응답 `200`

```json
{
  "data": [
    {
      "rank": 1,
      "applicationNumber": "4020230202582",
      "name": "PETBOON",
      "category": "03류 · 도형복합",
      "similarity": 74,
      "imagePath": "raw/cosmetic_9000/.../4020230202582_tm000001.jpg",
      "imageUrl": "/api/v1/projects/{projectId}/trademark-analyses/{analysisId}/matches/1/image"
    }
  ],
  "meta": {
    "timestamp": "2026-08-10T17:00:00"
  }
}
```

프론트 타입은 다음처럼 변경한다.

```ts
export type TrademarkMatch = {
  rank: number
  applicationNumber: string
  name: string
  category: string
  similarity: number
  imagePath: string | null // 호환용. 화면에서는 사용 금지
  imageUrl: string
}
```

## 4. 실제 상표 이미지 조회

목록에서 받은 `imageUrl`을 그대로 사용한다.

```http
GET /api/v1/projects/{projectId}/trademark-analyses/{analysisId}/matches/{rank}/image
Authorization: Bearer <accessToken>
Accept: image/*
```

### 성공 응답 `200`

- Body: JSON이 아닌 이미지 binary
- `Content-Type`: `image/jpeg` 또는 `image/png`
- `Content-Disposition`: `inline; filename="..."`

### 오류

| 상태 | 의미 | 프론트 처리 |
|---|---|---|
| `401` | 토큰 없음·만료 | 기존 refresh 로직 실행 후 한 번만 재시도 |
| `404` | 다른 사용자 소유, 잘못된 rank, 파일 없음 | 해당 행만 기본 이미지와 “이미지를 불러올 수 없음” 표시 |
| `500` | 이미지 저장소 읽기 실패 | 재시도 버튼 또는 안내 문구 표시 |

보안을 위해 다른 사용자 데이터도 `404`로 처리한다.

## 5. 프론트 구현 예시

### `auth.ts`에 binary 전용 요청 함수 추가

아래 함수는 현재 `accessToken`, `refreshAccessToken`, `AuthError`와 같은 모듈 안에 둔다.

```ts
export const apiBlobRequest = async (imageUrl: string, retry = true): Promise<Blob> => {
  const headers = new Headers({ Accept: 'image/*' })
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(imageUrl, { headers })

  if (response.status === 401 && retry && await refreshAccessToken()) {
    return apiBlobRequest(imageUrl, false)
  }

  if (!response.ok) {
    throw new AuthError('상표 이미지를 불러오지 못했습니다.', 'TRADEMARK_IMAGE_ERROR', response.status)
  }

  return response.blob()
}
```

현재 Docker/Nginx 및 Vite proxy는 `/api`를 같은 출처로 연결하므로 `imageUrl`을 그대로 호출한다.

### 결과 화면에서 Blob URL 생성

```ts
type MatchImage = { rank: number; src: string }

useEffect(() => {
  let disposed = false
  const createdUrls: string[] = []

  void Promise.all(trademarkMatches.map(async (match) => {
    const blob = await apiBlobRequest(match.imageUrl)
    const src = URL.createObjectURL(blob)
    createdUrls.push(src)
    return { rank: match.rank, src }
  })).then((images) => {
    if (!disposed) setTrademarkMatchImages(images)
  }).catch(() => {
    if (!disposed) setTrademarkMatchImages([])
  })

  return () => {
    disposed = true
    createdUrls.forEach(URL.revokeObjectURL)
  }
}, [trademarkMatches])
```

### 기존 목업 교체

현재 `App.tsx`의 아래 요소는 실제 이미지로 교체한다.

```tsx
<div className="trademark-match-visual trademark-match-placeholder" aria-hidden="true">
  <i /><b /><em />
</div>
```

교체 예시:

```tsx
const image = trademarkMatchImages.find((item) => item.rank === match.rank)

<div className="trademark-match-visual">
  {image
    ? <img src={image.src} alt={`${match.name} 유사 상표`} />
    : <span aria-label="상표 이미지를 불러올 수 없음" />}
</div>
```

## 6. 완료 체크리스트

- [ ] matches 응답에서 각 항목의 `imageUrl` 확인
- [ ] `imagePath`를 화면 URL로 사용하지 않음
- [ ] 이미지 요청에 Bearer token 포함
- [ ] 토큰 만료 시 refresh 후 한 번만 재시도
- [ ] 결과 화면에 서로 다른 실제 상표 이미지 3장 표시
- [ ] 다른 사용자 URL 접근 시 `404` 처리
- [ ] 화면 이동·재분석 시 `URL.revokeObjectURL` 호출
- [ ] 이미지 실패가 전체 분석 결과 화면을 깨뜨리지 않음

## 7. Backend 실행 조건

Docker Compose에서 Backend에 다음 설정이 적용된다.

```yaml
environment:
  TRADEMARK_IMAGE_ROOT: /app/trademark-data
volumes:
  - ./ai-server/data/trademarks:/app/trademark-data:ro
```

AI 서버의 `/app/data`와 Backend의 상표 데이터 mount는 모두 read-only다. Backend는 이미지 한 장을 최대 5MiB까지만 응답한다. 따라서 관련 컨테이너를 반드시 다시 빌드·생성해야 한다.
