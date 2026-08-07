# GenMark Core Postman 검증 결과

- 실행일: 2026-08-07 (Asia/Seoul)
- Runner: Newman 6.2.1
- Backend: `http://localhost:18080`
- DB: `project-db-campus.smhrd.com:3308 / cgi_25IS_GA3_p3_2`
- 유료 NVIDIA 생성 호출: 실행하지 않음

## 결과 요약

| 항목 | 결과 |
|---|---:|
| Iteration | 1 |
| Request | 13 |
| Test script | 13 |
| Assertion | 27 |
| 실패 | 0 |
| 총 실행 시간 | 약 1.53초 |

## 통과 흐름

1. Similarity AI `GET /health` → `200`, `status=ok`
2. Logo AI `GET /health` → `200`, `status=ok`
3. Local fake login → `200`, access/refresh token 발급
4. `GET /api/v1/me` → 로그인 회원 일치
5. 온보딩 완료 전 조회 → `200`
6. 온보딩 `SUBMITTED` 완료 → `200`, 초기 프로젝트 UUID 발급
7. 온보딩 재조회 → 완료 상태와 초기 프로젝트 UUID 일치
8. 초기 프로젝트 조회 → `200`, `BRIEF_READY`
9. 프로젝트 PATCH → tone/colors 저장 확인
10. final-review PUT → logoStyle 저장 확인
11. refresh token rotation → `200`
12. 새 access token으로 `GET /me` → `200`, `onboardingCompleted=true`
13. logout → `204`

## DB 정리

- 검증용 provider ID: `postman-frontend-handoff-smoke`
- 검증 후 fake 회원, 온보딩, 프로젝트 삭제 완료
- `smoke_members_remaining=0` 확인
- 실제 사용자 및 기존 회원은 삭제하지 않음

## 미실행 범위

- 실제 NVIDIA FLUX 로고 4개 생성
- 후보 이미지 저장 및 선택
- 실제 FAISS 상표 유사도 분석

위 범위는 `GenMark-ai-manual.postman_collection.json`에서 `runPaidAi=true`를 명시한 경우에만 수동 실행한다.
