-- V31: V30(다운로드를 리비전별로 집계)을 되돌린다.
--
-- 배경
-- - V30은 "로고 수정 전/후를 각각 받으면 다운로드도 각각 집계한다"를 위해
--   logo_downloads에 asset_revision 컬럼을 추가하고, UNIQUE 키를
--   (member_id, candidate_id) → (member_id, candidate_id, asset_revision)로 바꿨다.
-- - 이후 이 기능 전체를 원복하기로 결정해서 백엔드/프론트 코드는 모두 되돌렸다.
--   그래서 DB도 "후보당 다운로드 1건" 규칙으로 돌아가야 한다.
-- - V30 파일 자체는 지우지 않는다. 이미 적용된 마이그레이션 파일을 삭제하면
--   그걸 적용해둔 환경에서 Flyway가 "적용 기록은 있는데 파일이 없다"며 실패한다.
--   이 프로젝트 규칙대로 "새 번호로 되돌리는 마이그레이션을 추가"하는 방식을 쓴다.
--
-- V8과 같은 방식으로 idempotent(멱등)하게 작성했다 — V30을 적용한 적 없는 환경에서
-- 돌려도, 이미 되돌린 환경에서 다시 돌려도 안전하다.
--
-- ⚠ 주의: logo_downloads의 chk_download_project_type는 내부적으로 옛 Hibernate 별칭
--   (`ld1_0.project_type`)을 들고 있어 깨져 있을 수 있다. 이 상태에서는 이 테이블에
--   어떤 ALTER를 해도 "Unknown column '...ld1_0.project_type' in 'CHECK'"로 실패한다.
--   그래서 맨 먼저 이 CHECK를 지우고, 모든 작업을 끝낸 뒤 마지막에 다시 만든다.
--   중복 정리도 별칭 없는 DELETE로 처리해서, CHECK를 다시 만들 때 별칭이 박히지 않게 했다.

SET @db := DATABASE();

-- 1) CHECK 제거 — 이걸 먼저 지워야 아래 ALTER들이 통과한다.
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'logo_downloads'
        AND CONSTRAINT_NAME = 'chk_download_project_type') = 1,
    'ALTER TABLE `logo_downloads` DROP CONSTRAINT `chk_download_project_type`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) 리비전별로 쌓인 중복 정리 — (member_id, candidate_id)당 가장 먼저 만들어진 1건만 남긴다.
--    (member_id, candidate_id) UNIQUE를 다시 걸려면 중복이 없어야 한다.
--    임시 표를 거치는 이유: logo_downloads에 별칭을 붙인 DELETE를 쓰면 그 별칭이
--    아래 5번에서 다시 만드는 CHECK에 박혀서 또 깨지기 때문이다.
CREATE TEMPORARY TABLE IF NOT EXISTS tmp_keep_logo_downloads AS
  SELECT MIN(id) AS keep_id FROM logo_downloads GROUP BY member_id, candidate_id;

DELETE FROM logo_downloads
  WHERE id NOT IN (SELECT keep_id FROM tmp_keep_logo_downloads);

DROP TEMPORARY TABLE IF EXISTS tmp_keep_logo_downloads;

-- 3) UNIQUE 키를 (member_id, candidate_id, asset_revision) → (member_id, candidate_id)로 되돌린다.
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'logo_downloads'
        AND INDEX_NAME = 'uq_download_member_candidate_revision') > 0,
    'ALTER TABLE `logo_downloads` DROP INDEX `uq_download_member_candidate_revision`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'logo_downloads'
        AND INDEX_NAME = 'uq_download_member_candidate') = 0,
    'ALTER TABLE `logo_downloads` ADD CONSTRAINT `uq_download_member_candidate` UNIQUE (`member_id`, `candidate_id`)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) asset_revision 컬럼 제거 — 백엔드 엔티티에서 이미 사라진 컬럼이다.
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'logo_downloads'
        AND COLUMN_NAME = 'asset_revision') = 1,
    'ALTER TABLE `logo_downloads` DROP COLUMN `asset_revision`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5) CHECK 재생성 — 위에서 별칭 있는 DML을 쓰지 않았으므로 여기서 바로 만들어도 안전하다.
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'logo_downloads'
        AND CONSTRAINT_NAME = 'chk_download_project_type') = 0,
    'ALTER TABLE `logo_downloads` ADD CONSTRAINT `chk_download_project_type` CHECK (`project_type` IN (''CI'', ''BI''))',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
