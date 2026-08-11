-- V21: member_onboardings에서 미사용 details_decision 컬럼 제거
--
-- 배경
-- - details_decision은 "온보딩을 마칠 때 초기 CI/BI 프로젝트 정보까지 함께 제출했는가"를
--   표시하던 값이다. SUBMITTED(함께 제출) / SKIPPED(건너뜀) 두 가지였다.
-- - 이 설계는 온보딩 화면에서 프로젝트 상세까지 한 번에 받던 옛 흐름을 전제로 한다.
--
-- 왜 더 이상 필요 없나
-- - 지금 사용자 흐름은 "온보딩 -> 업종 선택 -> CI/BI 선택 -> 프로젝트 입력"으로 바뀌었다.
--   프로젝트 정보는 온보딩이 끝난 뒤에 별도 화면에서 받는다.
-- - 그래서 온보딩 화면에는 상세 입력란이 아예 없고, 프론트엔드는 항상 SKIPPED만 보낸다.
--   App.tsx에 그 이유가 주석으로 명시돼 있다:
--       "The project type and detailed project fields are collected after this
--        onboarding gate, so this first completion intentionally skips them."
-- - 즉 이 컬럼은 모든 행이 SKIPPED인 상수다. 값이 갈리지 않으므로 저장할 이유가 없다.
--
-- 함께 정리되는 것 (백엔드 코드)
-- - MemberOnboarding.DetailsDecision 열거형
-- - OnboardingUpsertRequest의 detailsDecision / initialCiProject / initialBiProject
-- - OnboardingService의 관련 검증 3개와 초기 프로젝트 생성 분기
-- - CiProjectService.createInitial / BiProjectService.createInitial (호출자가 사라짐)
-- - ErrorCode.ONBOARDING_DETAILS_REQUIRED
--
-- 잃는 데이터: 실질적으로 없다. 모든 행이 'SKIPPED'다.
--   (혹시 과거에 SUBMITTED로 만들어진 행이 있어도, 그때 만들어진 프로젝트는
--    ci_project / bi_project에 그대로 남아 있어 사라지지 않는다.)
--
-- V8/V9와 같은 방식으로 idempotent하게 작성했다 — 다시 돌려도 안전하다.

SET @db := DATABASE();

-- MariaDB 10.5는 CHECK 제약이 있는 테이블을 변경할 때 문제가 생길 수 있어
-- 관련 제약을 먼저 내렸다가 나중에 복원한다 (V9에서 쓴 것과 같은 방식).
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'member_onboardings'
        AND CONSTRAINT_NAME = 'chk_onboarding_decision' AND CONSTRAINT_TYPE = 'CHECK') = 1,
    'ALTER TABLE `member_onboardings` DROP CONSTRAINT `chk_onboarding_decision`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- details_decision 컬럼 제거 (남아있을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'member_onboardings' AND COLUMN_NAME = 'details_decision') = 1,
    'ALTER TABLE `member_onboardings` DROP COLUMN `details_decision`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
