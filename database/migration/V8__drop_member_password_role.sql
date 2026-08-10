-- V8: members 테이블에서 password / role 컬럼 제거
--
-- 배경
-- - 이메일/비밀번호 회원가입은 폐지됐다. 모든 로그인은 구글/카카오 소셜 로그인이며
--   백엔드는 비밀번호를 저장하지도, 검증하지도 않는다. (V4 시점에 이미 NULL 허용으로 완화됐고
--   실제 데이터도 전부 NULL이다.)
-- - role은 코드 어디에서도 권한 판정에 쓰이지 않았다. JWT 클레임에 실려 나가기만 했고
--   hasRole/@PreAuthorize 같은 검사는 존재하지 않는다. 관리자/일반 구분이 필요해지면
--   그때 별도 테이블이나 컬럼으로 다시 설계한다.
--
-- 주의: 컬럼을 지우면 기존 비밀번호 해시는 복구할 수 없다.
--       실행 전 members 테이블 백업을 권장한다 (아래 6장 참고: 작업 내용 .md).
--
-- V4와 같은 방식으로 idempotent하게 작성했다 — 이미 지워진 환경에서 다시 돌려도 안전하다.

SET @db := DATABASE();

-- password 컬럼 제거
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'members' AND COLUMN_NAME = 'password') = 1,
    'ALTER TABLE `members` DROP COLUMN `password`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- role 컬럼 제거
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'members' AND COLUMN_NAME = 'role') = 1,
    'ALTER TABLE `members` DROP COLUMN `role`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
