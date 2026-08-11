-- V19: member_onboardings에서 미사용 schema_version 컬럼 제거
--
-- 배경
-- - schema_version은 "이 온보딩 답변이 몇 번째 양식으로 받은 것인가"를 표시하려던 컬럼이다.
-- - 실제로는 저장할 때 항상 1을 고정으로 넣고, 응답 JSON에 실어 내보내기만 했다.
--   이 값을 읽어서 분기하거나 판단하는 코드가 어디에도 없다. 값이 1 외의 것이 된 적도 없다.
-- - 온보딩 양식이 실제로 바뀌는 시점에 그때 필요한 형태로 다시 설계하는 편이 낫다.
--   지금은 쓰지 않는 컬럼이 남아 있어 "이건 뭐지?" 하고 헷갈리게 만드는 비용만 있다.
--
-- 잃는 데이터: 없다. 모든 행의 값이 1이다.
--
-- V8/V9와 같은 방식으로 idempotent하게 작성했다 — 다시 돌려도 안전하다.

SET @db := DATABASE();

-- schema_version 컬럼 제거 (남아있을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'member_onboardings' AND COLUMN_NAME = 'schema_version') = 1,
    'ALTER TABLE `member_onboardings` DROP COLUMN `schema_version`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
