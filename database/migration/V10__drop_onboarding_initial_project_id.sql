-- V10: member_onboardings.initial_project_id 컬럼(과 FK) 제거
--
-- 배경
-- - 이 컬럼은 온보딩 중 "상세정보 제출(SUBMITTED)"을 선택하면 그 자리에서 만들어지는
--   첫 프로젝트를 온보딩 행과 연결해두려고 만든 컬럼이었다.
-- - 실제 프론트엔드 온보딩 화면은 사용처/방문목적 두 질문만 물어보고 항상 SKIPPED로
--   완료 처리한다(OnboardingService의 SUBMITTED 분기는 API상으로는 남아있지만 실사용
--   화면에서 호출되지 않는다). 그래서 이 컬럼은 실제 서비스 데이터에서 항상 NULL이었다.
-- - 로그인 시 "이어서 작업할 프로젝트"를 알려주는 값은 이제 auth 쪽 resumeProjectId
--   (AuthService.findResumeProjectId, GET /api/v1/me / POST /api/v1/auth/login)가
--   온보딩과 무관하게 계산해서 내려주므로 이 컬럼이 없어도 기능 손실이 없다.
-- - 프론트엔드가 OnboardingResponse.initialProjectId 대신 resumeProjectId를 쓰도록
--   전환하는 방법은 "작업 내용/frontend 전달/2026-08-10_initial_project_id-컬럼-삭제-예정-안내.md"에
--   정리해뒀다.
--
-- 주의 (MariaDB 10.5 버그 우회): member_onboardings에는 details_decision 컬럼에
-- chk_onboarding_decision CHECK 제약이 걸려 있는데, MariaDB 10.5.x에서 CHECK 제약이
-- 있는 테이블에 DROP FOREIGN KEY / DROP COLUMN을 하면
-- "Unknown column ... in CHECK" 오류가 나는 버그가 있다(실제 project-db-campus 서버에서
-- 확인됨, VERSION() = 10.5.10-MariaDB). 그래서 CHECK 제약을 먼저 내렸다가, 컬럼/FK를
-- 지운 뒤 다시 걸어주는 순서로 우회한다.
--
-- V8/V9과 같은 방식으로 idempotent하게 작성했다 — 이미 적용된 환경에서 다시 돌려도 안전하다.
--
-- 주의: 컬럼을 지우면 예전에 SUBMITTED로 완료된 온보딩 행이 있었다 해도 그 연결 정보는
--       복구할 수 없다. 실행 전 member_onboardings 테이블 백업을 권장한다.

SET @db := DATABASE();

-- 1) chk_onboarding_decision CHECK 제약을 임시로 제거 (남아있을 때만)
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

-- 2) FK 제약(fk_onboarding_project) 제거 (남아있을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'member_onboardings'
        AND CONSTRAINT_NAME = 'fk_onboarding_project' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 1,
    'ALTER TABLE `member_onboardings` DROP FOREIGN KEY `fk_onboarding_project`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) initial_project_id 컬럼 제거 (남아있을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'member_onboardings' AND COLUMN_NAME = 'initial_project_id') = 1,
    'ALTER TABLE `member_onboardings` DROP COLUMN `initial_project_id`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) chk_onboarding_decision CHECK 제약 다시 걸기 (없을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'member_onboardings'
        AND CONSTRAINT_NAME = 'chk_onboarding_decision' AND CONSTRAINT_TYPE = 'CHECK') = 0,
    'ALTER TABLE `member_onboardings` ADD CONSTRAINT `chk_onboarding_decision` CHECK (`details_decision` IN (''SUBMITTED'', ''SKIPPED''))',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
