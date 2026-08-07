-- V4: 구글/카카오 소셜 로그인 지원을 위한 members 테이블 확장
--
-- 로컬 개발 DB(genmark-mariadb-local)에는 이 컬럼들이 이미 수동으로 반영되어
-- 있었다(코드/마이그레이션에는 없던 상태). 이 파일은 그 상태를 정식 마이그레이션으로
-- 문서화하고, 아직 컬럼이 없는 환경(신규 로컬 셋업, 스테이징, 운영)에서도 동일하게
-- 적용되도록 idempotent하게 작성했다.
--
-- - provider / provider_id: 소셜 로그인 식별자. 로컬 이메일/비밀번호 회원은 provider='local'.
-- - password: 소셜 로그인 회원은 비밀번호가 없으므로 NULL 허용으로 완화.
-- - refresh_token_hash / refresh_token_expires_at: 리프레시 토큰은 원문을 저장하지 않고
--   SHA-256 해시만 저장한다. 별도 테이블 대신 회원당 1개(단일 세션) 정책.

SET @db := DATABASE();

-- password 컬럼 NULL 허용
SET @sql := (
  SELECT IF(
    (SELECT IS_NULLABLE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'members' AND COLUMN_NAME = 'password') = 'NO',
    'ALTER TABLE `members` MODIFY COLUMN `password` VARCHAR(255) NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- provider 컬럼 추가
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'members' AND COLUMN_NAME = 'provider') = 0,
    'ALTER TABLE `members` ADD COLUMN `provider` VARCHAR(20) NOT NULL DEFAULT ''local'' AFTER `role`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- provider_id 컬럼 추가
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'members' AND COLUMN_NAME = 'provider_id') = 0,
    'ALTER TABLE `members` ADD COLUMN `provider_id` VARCHAR(100) NULL AFTER `provider`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- refresh_token_hash 컬럼 추가
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'members' AND COLUMN_NAME = 'refresh_token_hash') = 0,
    'ALTER TABLE `members` ADD COLUMN `refresh_token_hash` VARCHAR(128) NULL AFTER `provider_id`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- refresh_token_expires_at 컬럼 추가
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'members' AND COLUMN_NAME = 'refresh_token_expires_at') = 0,
    'ALTER TABLE `members` ADD COLUMN `refresh_token_expires_at` DATETIME NULL AFTER `refresh_token_hash`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- (provider, provider_id) 유니크 제약
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'members'
        AND CONSTRAINT_NAME = 'uq_member_provider_provider_id') = 0,
    'ALTER TABLE `members` ADD CONSTRAINT `uq_member_provider_provider_id` UNIQUE (`provider`, `provider_id`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
