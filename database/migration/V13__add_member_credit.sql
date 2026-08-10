-- V13: members 테이블에 크레딧 잔액(credit_balance) 컬럼 추가
--
-- 배경
-- - 사용자는 가입 시 크레딧 2개를 받고, 로고를 쓸 때 차감되며, 설문조사에 응하면 2개를 더 받는다.
-- - "지금 몇 개 남았나"는 조회가 매우 잦으므로(화면 상단 표시, 관리자 회원관리 목록) 잔액을
--   members에 직접 둔다. 증감 내역은 V14의 credit_histories 테이블에 따로 쌓는다.
--
-- 기본값 2인 이유
-- - 신규 가입자에게 2개를 지급하는 정책이라, 애플리케이션 코드가 깜빡해도 DB가 2를 넣어준다.
-- - 이미 가입한 기존 회원에게도 이 마이그레이션 실행 시점에 2개가 채워진다(아래 UPDATE).
--
-- 차감 시점(생성 시점 vs 다운로드 시점)은 아직 미정이지만, 어느 쪽으로 정해도
-- 이 컬럼 구조는 바뀌지 않는다.
--
-- V8/V9와 같은 방식으로 idempotent하게 작성했다 — 다시 돌려도 안전하다.

SET @db := DATABASE();

-- credit_balance 컬럼 추가 (없을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'members' AND COLUMN_NAME = 'credit_balance') = 0,
    'ALTER TABLE `members` ADD COLUMN `credit_balance` INT NOT NULL DEFAULT 2 AFTER `provider_id`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
