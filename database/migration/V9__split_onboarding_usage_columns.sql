-- V9: member_onboardings.usage_json(JSON 배열)을 usage_1/usage_2/usage_3 컬럼 3개로 분리
--
-- 배경
-- - usage는 온보딩 1단계 "로고를 어디에 쓸 건가요?" 질문의 복수 선택 응답이다.
--   프론트에서 선택 가능한 값은 online/social/offline 3개뿐이라 배열 길이가 항상 1~3이다.
-- - 지금은 이 배열을 JSON 문자열(usage_json TEXT)로 통째로 저장하는데, 값 하나하나를
--   조회/집계하기 어려워서 컬럼 3개(usage_1 필수, usage_2·usage_3 선택)로 풀어서 저장한다.
-- - API 요청/응답 형태(usage: string[])는 그대로 유지한다. 배열 <-> 컬럼 3개 변환은
--   OnboardingService에서만 처리하므로 프론트엔드 코드 변경은 필요 없다.
--
-- 순서: 컬럼 3개 추가 -> 기존 usage_json 값 옮기기 -> usage_1을 NOT NULL로 확정 -> usage_json 제거
-- V8과 같은 방식으로 idempotent하게 작성했다 — 이미 적용된 환경에서 다시 돌려도 안전하다.
--
-- 주의: usage_json 컬럼을 지우면 원래 배열 순서(JSON 배열 순서)는 사라지고
--       usage_1/usage_2/usage_3 세 컬럼으로만 남는다. 실행 전 member_onboardings 테이블
--       백업을 권장한다.

SET @db := DATABASE();

-- MariaDB 10.5에서는 CHECK 제약이 있는 테이블의 컬럼을 변경할 때
-- "Unknown column ... in CHECK"가 발생할 수 있어 변환 동안만 제약을 내린다.
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

-- 1) usage_1 컬럼 추가 (없을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'member_onboardings' AND COLUMN_NAME = 'usage_1') = 0,
    'ALTER TABLE `member_onboardings` ADD COLUMN `usage_1` VARCHAR(100) NULL AFTER `member_id`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) usage_2 컬럼 추가 (없을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'member_onboardings' AND COLUMN_NAME = 'usage_2') = 0,
    'ALTER TABLE `member_onboardings` ADD COLUMN `usage_2` VARCHAR(100) NULL AFTER `usage_1`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) usage_3 컬럼 추가 (없을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'member_onboardings' AND COLUMN_NAME = 'usage_3') = 0,
    'ALTER TABLE `member_onboardings` ADD COLUMN `usage_3` VARCHAR(100) NULL AFTER `usage_2`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) 기존 usage_json 값을 usage_1/usage_2/usage_3으로 옮기기 (usage_json이 남아있을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'member_onboardings' AND COLUMN_NAME = 'usage_json') = 1,
    'UPDATE `member_onboardings` SET
        `usage_1` = COALESCE(`usage_1`, JSON_UNQUOTE(JSON_EXTRACT(`usage_json`, ''$[0]''))),
        `usage_2` = COALESCE(`usage_2`, JSON_UNQUOTE(JSON_EXTRACT(`usage_json`, ''$[1]''))),
        `usage_3` = COALESCE(`usage_3`, JSON_UNQUOTE(JSON_EXTRACT(`usage_json`, ''$[2]'')))
     WHERE `usage_json` IS NOT NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5) usage_1을 NOT NULL로 확정 (백필 이후, 아직 nullable일 때만)
SET @sql := (
  SELECT IF(
    (SELECT IS_NULLABLE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'member_onboardings' AND COLUMN_NAME = 'usage_1') = 'YES',
    'ALTER TABLE `member_onboardings` MODIFY COLUMN `usage_1` VARCHAR(100) NOT NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6) usage_json 컬럼 제거 (남아있을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'member_onboardings' AND COLUMN_NAME = 'usage_json') = 1,
    'ALTER TABLE `member_onboardings` DROP COLUMN `usage_json`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 변환 중 임시로 제거한 CHECK 제약 복원 (없을 때만)
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
