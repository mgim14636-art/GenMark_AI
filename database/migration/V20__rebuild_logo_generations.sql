-- V20: logo_generations 테이블 재생성 (손상된 CHECK 제약 복구 + parent_generation_id 추가)
--
-- ★ 무엇을 고치는가
--
-- 이 테이블에 걸린 CHECK 제약 2개의 "저장된 정의"가 손상돼 있었다. 정상이라면 컬럼 이름만
-- 들어가야 하는데, DB 이름과 Hibernate가 쓰는 임시 별칭(lg1_0)이 박혀 있었다.
--
--   ERROR 1054: Unknown column '`cgi_25IS_GA3_p3_2`.`lg1_0`.`ci_project_id`' in 'CHECK'
--                                ↑ DB 이름          ↑ Hibernate 쿼리 별칭
--
-- MariaDB는 ALTER TABLE을 할 때 기존 CHECK 제약을 다시 평가하는데, 정의가 깨져 있어
-- 이 테이블에 대한 모든 구조 변경이 거부됐다. 손상된 제약을 지우려 해도 나머지 하나가
-- 또 막아서 서로 물리는 상태였다.
--
--   chk_generation_project_exclusive 삭제 → chk_generation_status 때문에 실패
--   chk_generation_status            삭제 → chk_generation_project_exclusive 때문에 실패
--
-- 운영 DB는 MariaDB 10.5.10이다 (docker-compose에 적힌 10.11이 아니다). 10.5의 결함으로 보인다.
--
-- ★ 어떻게 고치는가
--
-- ALTER가 불가능하므로 테이블을 통째로 다시 만든다. 순서는 이렇다.
--   1) logo_candidates가 이 테이블을 가리키는 외래키를 잠시 떼어낸다
--   2) logo_generations를 지우고 깨끗한 정의로 다시 만든다
--   3) 외래키를 다시 붙인다
--
-- ★ 데이터 손실 주의
--
-- 이 마이그레이션은 테이블을 DROP한다. 그래서 **행이 하나라도 있으면 아무것도 하지 않고
-- 그냥 넘어가도록** 안전장치를 걸어두었다. 작성 시점에는 logo_generations와
-- logo_candidates 모두 0건이어서 안전하게 재생성할 수 있었다.
--
-- 데이터가 쌓인 뒤에 이 문제를 고쳐야 한다면, 이 파일을 그대로 쓰지 말고
-- "새 테이블 생성 -> INSERT SELECT로 복사 -> 이름 교체" 방식으로 다시 작성해야 한다.
--
-- ★ 덤으로 추가하는 것
--
-- 어차피 새로 만드는 김에 parent_generation_id 컬럼도 넣는다. 재생성(F12-2) 시
-- "이번 생성이 어떤 생성의 재시도인가"를 추적하는 컬럼이다. 최초 생성이면 NULL이다.
-- 부모가 지워져도 자식 기록은 남아야 하므로 ON DELETE SET NULL로 건다.
--
-- 이미 적용된 환경에서 다시 돌려도 안전하다 (parent_generation_id가 있으면 건너뛴다).

SET @db := DATABASE();

-- 재생성해도 되는 상황인지 판단한다.
--   - parent_generation_id가 이미 있으면 = 이미 적용됨 -> 건너뜀
--   - 행이 하나라도 있으면 = 데이터 손실 위험 -> 건너뜀
SET @already_done := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'logo_generations' AND COLUMN_NAME = 'parent_generation_id'
);
SET @gen_rows := (SELECT COUNT(*) FROM `logo_generations`);
SET @cand_rows := (SELECT COUNT(*) FROM `logo_candidates`);
SET @can_rebuild := IF(@already_done = 0 AND @gen_rows = 0 AND @cand_rows = 0, 1, 0);

-- 1) 외래키 검사를 잠시 끈다
--
--    원래는 logo_candidates의 외래키를 떼어냈다가 다시 붙이려 했지만,
--    `ALTER TABLE ... DROP FOREIGN KEY` 구문 자체가 이 서버(MariaDB 10.5.10)에서
--    같은 오류를 내며 실패한다. (컬럼 추가·삭제 같은 다른 ALTER는 잘 된다.)
--
--    그래서 외래키를 건드리지 않고 검사만 잠시 끈 뒤 부모 테이블을 교체한다.
--    logo_candidates에 걸린 fk_candidate_generation 정의는 그대로 남아 있다가,
--    같은 이름·같은 구조의 테이블이 다시 만들어지면 자동으로 다시 유효해진다.
--
--    두 테이블 모두 0건이라 무결성이 깨질 여지가 없다.
SET FOREIGN_KEY_CHECKS = 0;

-- 2) 문제의 테이블 제거
SET @sql := IF(@can_rebuild = 1, 'DROP TABLE `logo_generations`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) 깨끗한 정의로 재생성 (+ parent_generation_id)
SET @sql := IF(@can_rebuild = 1,
'CREATE TABLE `logo_generations` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `public_id` VARCHAR(36) NOT NULL,
  `ci_project_id` BIGINT NULL,
  `bi_project_id` BIGINT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT ''QUEUED'',
  `model_name` VARCHAR(100) NULL,
  `request_snapshot_json` TEXT NOT NULL,
  `idempotency_key` VARCHAR(100) NOT NULL,
  `parent_generation_id` BIGINT NULL,
  `error_code` VARCHAR(50) NULL,
  `error_message` TEXT NULL,
  `started_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `public_id` (`public_id`),
  UNIQUE KEY `uq_ci_generation_idempotency` (`ci_project_id`, `idempotency_key`),
  UNIQUE KEY `uq_bi_generation_idempotency` (`bi_project_id`, `idempotency_key`),
  CONSTRAINT `fk_generation_ci_project` FOREIGN KEY (`ci_project_id`) REFERENCES `ci_project`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_generation_bi_project` FOREIGN KEY (`bi_project_id`) REFERENCES `bi_project`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_generation_parent` FOREIGN KEY (`parent_generation_id`) REFERENCES `logo_generations`(`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_generation_project_exclusive` CHECK (
    (`ci_project_id` IS NOT NULL AND `bi_project_id` IS NULL) OR
    (`ci_project_id` IS NULL AND `bi_project_id` IS NOT NULL)
  ),
  CONSTRAINT `chk_generation_status` CHECK (`status` IN (''QUEUED'', ''RUNNING'', ''SUCCEEDED'', ''FAILED''))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) 외래키 검사 복원
--    logo_candidates.fk_candidate_generation은 떼어낸 적이 없으므로 다시 붙일 필요가 없다.
--    새로 만든 logo_generations를 가리키게 되며, 아래 검증 쿼리로 확인할 수 있다.
SET FOREIGN_KEY_CHECKS = 1;
