# Recraft 로고 생성 — Frontend 팀 전달 명세

> 목적: 사용자가 선택한 로고 옵션을 빠짐없이 Backend에 전달하고, 생성 결과를 이미지와 UI 정보로 구분해 표시한다.

## 1. Frontend 담당 문제

- `includeBrandName`은 화면 상태에는 있지만 Backend 요청에 포함되지 않는다.
- `motifCategories`, `concreteness`의 Frontend → Backend 계약이 없다.
- `후보 1~4`, `GENMARK AI`는 현재 화면에 하드코딩된 UI 문구다.
- 색상 `colors[]`는 현재 `color1~4`로 정상 변환되고 있다.

색상이 정확히 나오지 않는 주원인은 AI 쪽이지만, Frontend는 선택한 HEX가 변형 없이 Backend까지 전달되는 것을 보장해야 한다.

## 2. Backend로 보낼 필드

```ts
type LogoProjectInput = {
  brandType: 'CI' | 'BI'
  industry: string
  brandName?: string
  companyName?: string
  brandValues?: string[]
  brandValuesText?: string
  targetAge?: string
  tone: string
  colorMode: 'MANUAL' | 'TONE'
  colors: string[]
  logoStyle: 'symbol' | 'wordmark' | 'combination' | 'lettermark'
  includeBrandName: boolean
  motifCategories?: string[]
  concreteness?: string
  additionalRequirements?: string
}
```

Backend 요청으로 변환할 때:

```json
{
  "colorMode": "MANUAL",
  "color1": "#EF5B7A",
  "color2": "#75ADD2",
  "color3": null,
  "color4": null,
  "logoStyle": "combination",
  "includeBrandName": true,
  "motifCategories": ["기하학적 도형"],
  "concreteness": "적당히 단순화",
  "additionalRequirements": "부드러운 소용돌이 형태"
}
```

## 3. 구현 요청

1. `ProjectInput`에 다음 필드를 명시한다.

```text
motifCategories
concreteness
```

2. `toCiProjectRequest`, `toBiProjectRequest`에서 아래 값을 누락하지 않는다.

```text
colorMode
includeBrandName
motifCategories
concreteness
```

3. 수동 색상은 전송 전에 대문자 `#RRGGBB` 형식으로 정규화한다.
4. `colorMode === 'MANUAL'`이면 색상을 최소 한 개 이상 요구한다.
5. 생성 결과의 `후보 1~4`, `GENMARK AI`는 이미지 바깥의 UI 라벨로만 표시한다.
6. 가능하면 생성 응답의 `modelName`을 개발자 확인용 정보로 표시한다.

## 4. 하지 말아야 할 것

- HEX를 `pink`, `blue` 같은 색상명으로 바꾸지 않는다.
- 후보 번호나 `GENMARK AI`를 이미지에 합성하지 않는다.
- 사용자가 선택하지 않은 기본값으로 기존 선택값을 덮어쓰지 않는다.

## 5. Frontend 검증 기준

브라우저 Network 탭에서 다음을 확인한다.

- [ ] 선택한 HEX가 `color1~4`에 정확히 존재한다.
- [ ] `colorMode`가 존재한다.
- [ ] `includeBrandName`이 존재한다.
- [ ] 모티프를 골랐다면 `motifCategories`가 존재한다.
- [ ] 구체성을 골랐다면 `concreteness`가 존재한다.
- [ ] 로고 PNG 안에는 후보 번호나 `GENMARK AI`가 없다.
- [ ] 후보 4개를 이동해도 각각 올바른 이미지가 표시된다.

## 6. Backend 팀과 합의할 항목

- 필드명과 허용값
- 빈 배열과 `null` 처리 방식
- `logoStyle` 영문값 → AI 한글값 변환 책임은 Backend가 담당
- 응답의 실제 모델명과 SVG 제공 여부

