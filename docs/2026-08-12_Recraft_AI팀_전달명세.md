# Recraft 로고 생성 — AI 팀 전달 명세

> 목적: Backend가 전달한 설문과 정확한 HEX 팔레트를 Recraft 생성 및 SVG 후처리에 반영하고, 투명 배경 PNG와 원본 SVG를 반환한다.

## 1. AI 담당 문제

- 선택한 HEX를 `pink`, `sky blue` 같은 일반 색상명으로 바꾼다.
- Recraft에는 색상 변수를 별도로 보내지 않고 `prompt` 문자열에만 포함한다.
- 프롬프트 준수만으로 정확한 색상을 보장하려 한다.
- SVG 배경 제거가 실패하면 검은 사각형이 남는다.
- Recraft 심볼 아래에 Pillow로 합성한 브랜드명 배치가 어색할 수 있다.

## 2. Backend에서 받을 변수

```text
ci_bi
brand_name
company_name
brand_values
brand_values_text
company_values
company_values_text
style
industry
tone
target_age
color_mode
color_manual
motif_category
concreteness
additional_requirements
text_color
include_brand_name_in_logo
num_variants
variant_offset
```

예시:

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

## 3. 현재 Recraft/OpenRouter 요청

```json
{
  "model": "recraft/recraft-v4-vector",
  "prompt": "설문을 조합한 영어 문장",
  "aspect_ratio": "1:1"
}
```

Recraft 응답에서 읽는 값:

```text
data[0].b64_json
```

벡터 모델에서는 이를 Base64 디코딩하여 SVG 문자열로 사용한다.

## 4. 구현 요청

1. `_resolve_colors()`에서 HEX를 일반 색상명으로 대체하지 않는다.
2. 프롬프트에 색상명과 정확한 HEX를 함께 적는다.

```text
Use #EF5B7A as the primary color and #75ADD2 as the accent color.
Use only these requested palette colors except transparency.
Do not introduce black, white fills, gradients, or shadows.
```

3. 프롬프트만으로 색상을 보장하지 말고, SVG 응답의 `fill`·`stroke`를 선택 팔레트로 정규화한다.
4. 첫 번째 색상은 primary, 두 번째 이후는 accent로 취급한다.
5. SVG 배경을 투명하게 만든다. 캔버스 전체를 덮는 배경 도형만 제거한다.
6. `include_brand_name_in_logo`와 `style`을 아래처럼 처리한다.

```text
include_brand_name_in_logo=false → 심볼만
include_brand_name_in_logo=true  → 심볼 + 브랜드명 합성
style=워드마크                 → 텍스트 중심
style=레터마크                 → 이니셜 중심
style=혼합형                   → 심볼 + 브랜드명
```

7. 브랜드명 합성 시 심볼 영역과 텍스트 영역을 분리하고, 배경색을 확장해 검은 박스를 만들지 않는다.
8. 응답에 실제 모델명을 포함한다.

## 5. Backend로 반환할 응답

```json
{
  "model": "recraft/recraft-v4-vector",
  "logos": [
    {
      "imageBase64": "최종 PNG Base64",
      "svg": "Recraft SVG 원본 또는 후처리 SVG",
      "seed": null,
      "variantIndex": 0
    }
  ]
}
```

`imageBase64`와 `svg`의 의미:

```text
imageBase64 → Frontend 표시와 유사도 분석에 사용하는 최종 PNG
svg         → 벡터 다운로드·후속 편집용 SVG
```

## 6. 로그 기준

비밀키는 출력하지 않고 다음만 기록한다.

```text
model
variantIndex
requested palette
prompt hash 또는 request id
Recraft 응답 시간
SVG 파싱 결과
배경 제거 결과
팔레트 정규화 결과
```

## 7. AI 검증 기준

테스트 입력:

```text
색상: #EF5B7A, #75ADD2
로고 유형: 혼합형
브랜드명 포함: true
모티프: 기하학적 도형
```

완료 조건:

- [ ] 최종 프롬프트에 두 HEX가 모두 존재한다.
- [ ] 최종 SVG `fill` 또는 `stroke`에 선택한 HEX가 존재한다.
- [ ] 요청하지 않은 검은 배경이 없다.
- [ ] PNG 배경 alpha가 투명하다.
- [ ] 브랜드명 포함 false일 때 텍스트가 없다.
- [ ] 후보 4개의 모티프가 서로 구분된다.
- [ ] `imageBase64`, `svg`, `variantIndex`, `model`을 반환한다.

## 8. 타 팀과 합의할 항목

- Backend와 snake_case 요청 필드 확정
- Backend와 `model`, `svg` 응답 계약 확정
- 정확한 색상 보장의 기준을 프롬프트가 아닌 최종 SVG 값으로 합의
- SVG 원본과 후처리본 중 무엇을 저장·다운로드할지 합의

