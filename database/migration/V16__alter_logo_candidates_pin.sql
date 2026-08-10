-- V16: logo_candidates에 찜(pinned_at) 컬럼 추가, 미사용 saved 컬럼 제거
--
-- 배경
-- - "찜"은 애매하게 마음에 드는 로고를 임시 보관하는 기능이다. 보관 기간은 3일이고
--   지나면 자동으로 해제된다. 따라서 켜짐/꺼짐만으로는 부족하고 "언제 찜했는지"가 필요하다.
--
-- saved 컬럼을 지우는 이유
-- - saved는 컬럼과 자바 필드가 있고 조회 응답에도 실려 나가지만, 값을 저장하는 코드가
--   어디에도 없어 항상 false였다. 사실상 죽은 컬럼이다.
-- - 찜 상태를 pinned_at 하나로 관리하면 "찜했나?"는 pinned_at IS NOT NULL 로 판정된다.
--   saved를 남겨두면 "saved=true인데 pinned_at은 NULL" 같은 모순 상태가 만들어질 수 있어
--   함께 정리한다.
-- - 항상 false였으므로 지워도 잃는 데이터가 없다.
--
-- selected 컬럼은 그대로 둔다
-- - selected는 "이 프로젝트에서 최종 채택한 로고"를 뜻하고 실제로 동작 중인 기능이다.
--   찜(보류) / 선택(채택) / 다운로드(내려받음)는 서로 다른 상태이므로 섞지 않는다.
--
-- 인덱스
-- - 3일 지난 찜을 정리하는 배치가 pinned_at 조건으로 전체를 훑기 때문에 인덱스를 건다.
--
-- V8/V9와 같은 방식으로 idempotent하게 작성했다 — 다시 돌려도 안전하다.

SET @db := DATABASE();

-- 1) pinned_at 컬럼 추가 (없을 때만). NULL이면 찜하지 않은 상태
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'logo_candidates' AND COLUMN_NAME = 'pinned_at') = 0,
    'ALTER TABLE `logo_candidates` ADD COLUMN `pinned_at` DATETIME NULL AFTER `selected`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) 만료 정리 배치용 인덱스 추가 (없을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'logo_candidates' AND INDEX_NAME = 'idx_candidate_pinned') = 0,
    'ALTER TABLE `logo_candidates` ADD INDEX `idx_candidate_pinned` (`pinned_at`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) 쓰이지 않는 saved 컬럼 제거 (남아있을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'logo_candidates' AND COLUMN_NAME = 'saved') = 1,
    'ALTER TABLE `logo_candidates` DROP COLUMN `saved`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
