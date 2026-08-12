-- V23: ci_project / bi_project의 color_1, color_2를 NULL 허용으로 변경
--
-- 배경
-- - F9(이어쓰기)를 CI/BI 1번 화면(회사명·모토 등, 'brand-brief' 단계) 제출 시점부터도
--   동작하게 하려면, 그 시점에 색상 정보 없이 프로젝트 행을 미리 만들어야 한다.
-- - 그런데 color_1/color_2가 NOT NULL이라 그 시점엔 저장 자체가 거부됐다. color_3/color_4는
--   이미 NULL을 허용하는데 color_1/color_2만 그렇지 않아 앞뒤가 안 맞는 상태였다.
--
-- 실제 동작에는 영향이 없다
-- - 로고 생성은 항상 'tone' 단계(색상 선택)를 지난 뒤에만 시작되므로, 실제로 AI에게 생성을
--   요청하는 시점에는 color_1/color_2가 항상 채워져 있다. NULL로 남는 경우는 "1번 화면만
--   제출하고 2번 화면에서 이탈한, 아직 색상을 안 고른 중간 상태"뿐이다.
-- - ProjectLike.colorList()는 이미 null을 걸러내도록 작성돼 있어(Stream.filter(Objects::nonNull))
--   NULL이 섞여도 에러가 나지 않는다.
--
-- ★ 덤으로 같이 고치는 것 — current_step 상한이 이미 실제로 깨지고 있었다
--
-- 어제(2026-08-11) "이어쓰기 시 화면이 한 단계 되돌아가는" 문제를 고치면서 current_step에
-- "제출한 단계 번호 + 1"을 저장하도록 바꿨다. 그런데 CI는 마지막 단계(final-review)가 4번이라
-- +1 하면 5가 되는데, chk_ci_current_step은 아직 `BETWEEN 1 AND 4`로 남아 있었다. 그래서
-- "로고 생성하기"를 누르는 마지막 제출에서 매번 이 제약에 걸려 실패하고 있었다
-- (실제 백엔드 로그에서 확인함: CONSTRAINT `chk_ci_current_step` failed). BI도 마찬가지로
-- 마지막 단계가 5번이라 +1인 6을 허용해야 하는데 `BETWEEN 1 AND 5`로 남아 있어 같은 문제가
-- 있다. 이번 마이그레이션에서 상한을 CI는 5, BI는 6으로 같이 올린다.
--
-- ★ MariaDB 10.5.10 CHECK 제약 손상 문제 (V20과 같은 종류) — 하나씩 지우면 안 된다
--
-- color_1 제약만 지우려 했는데 이런 오류가 났다.
--
--   ERROR 1054: Unknown column '...`cp1_0`.`status`' in 'CHECK'
--
-- 원인을 좁혀보니 `chk_ci_current_step`의 내부 표현이 손상돼 있었다(겉보기엔
-- information_schema에 정상 문구로 보이지만, MariaDB가 ALTER 시 내부적으로 재평가하는
-- 단계에서는 Hibernate 쿼리 별칭(cp1_0)이 박힌 손상된 형태를 참조한다). 문제는 이 표의
-- 제약을 "하나씩" 지우면, 지울 때마다 MariaDB가 "남아있는 나머지 제약"을 전부 재평가하는데,
-- 그 재평가 대상에 아직 안 지운 손상된 chk_ci_current_step이 포함되어 매번 걸린다.
--
-- 해결: 지울 제약 6개를 전부 "한 개의 ALTER TABLE 문"에 콤마로 묶어서 한 번에 처리한다.
-- 이러면 문장이 끝나는 시점에는 이미 전부 사라진 뒤라 재평가할 손상된 제약이 남아있지 않다.
-- 새로 추가하는 제약도 마찬가지로 한 문장에 묶는다.
--
-- 여러 번 실행해도 안전하다 (이미 NULL 허용이면 건너뛴다).

SET @db := DATABASE();

-- ── ci_project ──────────────────────────────────────────────────────────

SET @ci_needs_change := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ci_project'
     AND COLUMN_NAME = 'color_1' AND IS_NULLABLE = 'NO'
);

SET @sql := IF(@ci_needs_change = 1,
'ALTER TABLE `ci_project`
  DROP CONSTRAINT `chk_ci_project_status`,
  DROP CONSTRAINT `chk_ci_current_step`,
  DROP CONSTRAINT `chk_ci_color_1`,
  DROP CONSTRAINT `chk_ci_color_2`,
  DROP CONSTRAINT `chk_ci_color_3`,
  DROP CONSTRAINT `chk_ci_color_4`,
  MODIFY COLUMN `color_1` VARCHAR(7) NULL,
  MODIFY COLUMN `color_2` VARCHAR(7) NULL',
'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@ci_needs_change = 1,
'ALTER TABLE `ci_project`
  ADD CONSTRAINT `chk_ci_project_status` CHECK (`status` IN (''DRAFT'',''BRIEF_READY'',''GENERATING'',''RESULT_READY'',''ANALYZING'',''COMPLETED'')),
  ADD CONSTRAINT `chk_ci_current_step` CHECK (`current_step` BETWEEN 1 AND 5),
  ADD CONSTRAINT `chk_ci_color_1` CHECK (`color_1` IS NULL OR `color_1` REGEXP ''^#[0-9A-Fa-f]{6}$''),
  ADD CONSTRAINT `chk_ci_color_2` CHECK (`color_2` IS NULL OR `color_2` REGEXP ''^#[0-9A-Fa-f]{6}$''),
  ADD CONSTRAINT `chk_ci_color_3` CHECK (`color_3` IS NULL OR `color_3` REGEXP ''^#[0-9A-Fa-f]{6}$''),
  ADD CONSTRAINT `chk_ci_color_4` CHECK (`color_4` IS NULL OR `color_4` REGEXP ''^#[0-9A-Fa-f]{6}$'')',
'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── bi_project (같은 방식) ─────────────────────────────────────────────────

SET @bi_needs_change := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'bi_project'
     AND COLUMN_NAME = 'color_1' AND IS_NULLABLE = 'NO'
);

SET @sql := IF(@bi_needs_change = 1,
'ALTER TABLE `bi_project`
  DROP CONSTRAINT `chk_bi_project_status`,
  DROP CONSTRAINT `chk_bi_current_step`,
  DROP CONSTRAINT `chk_bi_target_age`,
  DROP CONSTRAINT `chk_bi_color_1`,
  DROP CONSTRAINT `chk_bi_color_2`,
  DROP CONSTRAINT `chk_bi_color_3`,
  DROP CONSTRAINT `chk_bi_color_4`,
  MODIFY COLUMN `color_1` VARCHAR(7) NULL,
  MODIFY COLUMN `color_2` VARCHAR(7) NULL',
'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@bi_needs_change = 1,
'ALTER TABLE `bi_project`
  ADD CONSTRAINT `chk_bi_project_status` CHECK (`status` IN (''DRAFT'',''BRIEF_READY'',''GENERATING'',''RESULT_READY'',''ANALYZING'',''COMPLETED'')),
  ADD CONSTRAINT `chk_bi_current_step` CHECK (`current_step` BETWEEN 1 AND 6),
  ADD CONSTRAINT `chk_bi_target_age` CHECK (`target_age` IN (''10~20'',''30~40'',''50~60'',''전 연령층'')),
  ADD CONSTRAINT `chk_bi_color_1` CHECK (`color_1` IS NULL OR `color_1` REGEXP ''^#[0-9A-Fa-f]{6}$''),
  ADD CONSTRAINT `chk_bi_color_2` CHECK (`color_2` IS NULL OR `color_2` REGEXP ''^#[0-9A-Fa-f]{6}$''),
  ADD CONSTRAINT `chk_bi_color_3` CHECK (`color_3` IS NULL OR `color_3` REGEXP ''^#[0-9A-Fa-f]{6}$''),
  ADD CONSTRAINT `chk_bi_color_4` CHECK (`color_4` IS NULL OR `color_4` REGEXP ''^#[0-9A-Fa-f]{6}$'')',
'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
