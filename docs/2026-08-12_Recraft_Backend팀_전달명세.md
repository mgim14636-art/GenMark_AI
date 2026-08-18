# Recraft 로고 생성 — Backend 팀 전달 명세

> 목적: Frontend 입력값을 프로젝트와 생성 이력에 보존하고, 의미를 잃지 않은 상태로 AI 서버에 전달한다.

## 1. Backend 담당 문제

- 생성 이력 `modelName`이 아직 `black-forest-labs/flux.2-klein-4b`로 하드코딩되어 있다.
- `color_mode`가 현재 프로젝트 상태와 관계없이 `MANUAL`로 만들어진다.
- `includeBrandName`, `motifCategories`, `concreteness` 저장·전달 계약이 없다.
- AI 서버가 반환하는 `svg`를 `FastApiLogoAiClient`가 읽지 않고 버린다.

색상 HEX 자체는 현재 `color1~4 → color_manual[]` 경로로 전달되고 있다.

## 2. Frontend에서 받을 요청 필드

CI/BI 프로젝트 DTO에 다음 계약이 필요하다.

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

## 3. AI 서버로 보낼 요청

```json
{
  "ci_bi": "BI",
  "brand_name": "서성찬",
  "industry": "뷰티",
  "tone": "감성적이고 따뜻한",
  "color_mode": "manual",
  "color_manual": ["#EF5B7A", "#75ADD2"],
  "style": "혼합형",
  "include_brand_name_in_logo": true,
  "motif_category": ["기하학적 도형"],
  "concreteness": "적당히 단순화",
  "additional_requirements": "부드러운 소용돌이 형태",
  "num_variants": 4,
  "variant_offset": 0
}
```

변환 규칙:

```text
MANUAL → color_mode: manual
TONE   → color_mode: ai
symbol      → style: 심볼
wordmark    → style: 워드마크
combination → style: 혼합형
lettermark  → style: 레터마크
```

## 4. 구현 요청

1. CI/BI 요청 DTO와 Entity에 다음 값을 추가·보존한다.

```text
colorMode
includeBrandName
motifCategories
concreteness
```

2. `CiProject.toSurvey()`, `BiProject.toSurvey()`에서 AI snake_case 필드로 변환한다.
3. 생성 이력의 모델명을 실제 모델과 일치시킨다.

```text
recraft/recraft-v4-vector
```

가능하면 AI 응답의 `model`을 기록하여 다시 하드코딩하지 않는다.

4. AI 응답 DTO를 다음과 같이 확장한다.

```java
record GeneratedLogo(
    String imageBase64,
    String svg,
    Integer seed,
    Integer variantIndex
) {}
```

5. PNG는 화면 표시용으로 저장하고 SVG는 편집·다운로드용으로 별도 보존한다.
6. 신규 DB 컬럼이 필요하면 migration과 `database/schema.sql`을 같이 변경한다.
7. 생성 당시 입력값은 `request_snapshot_json`에 남긴다.

## 5. AI 서버 응답 계약

```json
{
  "model": "recraft/recraft-v4-vector",
  "logos": [
    {
      "imageBase64": "iVBORw0KGgo...",
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\">...</svg>",
      "seed": null,
      "variantIndex": 0
    }
  ]
}
```

## 6. 하지 말아야 할 것

- 모델명을 Flux로 고정 기록하지 않는다.
- Frontend가 보낸 HEX를 변경하지 않는다.
- AI 응답의 SVG를 조용히 버리지 않는다.
- Flyway 비활성 상태에서 migration이 자동 적용된다고 가정하지 않는다.

## 7. Backend 검증 기준

- [ ] 프로젝트 조회 응답에서 저장한 옵션이 동일하게 반환된다.
- [ ] `request_snapshot_json`에 색상과 옵션이 존재한다.
- [ ] Backend → AI 요청에 정확한 HEX가 존재한다.
- [ ] `include_brand_name_in_logo`, `motif_category`, `concreteness`가 전달된다.
- [ ] 생성 이력 `modelName`이 Recraft다.
- [ ] AI 응답 SVG가 저장된다.
- [ ] 기존 PNG 후보 조회·선택·다운로드가 회귀하지 않는다.

## 8. 타 팀과 합의할 항목

- Frontend와 요청 필드명·허용값 확정
- AI와 `model`, `svg` 응답 필드 확정
- SVG 저장 경로 및 다운로드 API 확정
- DB migration 실제 적용 담당자와 시점 확정

