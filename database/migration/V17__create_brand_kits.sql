-- V17: 브랜드킷 결과물 테이블(brand_kits) 생성
--
-- 배경
-- - 브랜드킷은 완성된 로고를 실제 물건에 얹어 보여주는 기능이다.
--     CI -> 로고가 박힌 명함 이미지
--     BI -> 로고가 박힌 로션 병 + 컨셉에 맞는 배경 (예: 친환경 로고면 풀 배경)
-- - AI가 이미지를 만드는 작업이라 수 초~수십 초가 걸리고 실패할 수도 있다. 그래서
--   logo_generations / trademark_analyses와 똑같은 비동기 작업 구조(status + error + 시각)를 따른다.
--   요청을 받으면 QUEUED로 행을 만들고 즉시 응답한 뒤, 백그라운드에서 처리하며 상태를 갱신한다.
--
-- candidate_id를 참조하는 이유
-- - 브랜드킷은 "어떤 로고로 만들었는가"가 핵심이다. 프로젝트가 아니라 로고 후보 한 장에 달린다.
--   CI/BI 구분은 candidate -> generation -> project 를 따라가면 알 수 있다.
--
-- kit_type
-- - BUSINESS_CARD(명함) | BOTTLE(로션병). CI는 명함, BI는 로션병을 만든다.
--
-- 주의: AI 서버에 브랜드킷 생성 엔드포인트가 아직 없다. 이 테이블과 백엔드 처리 로직은
--       준비해두지만, 실제 이미지 생성은 AI 담당자 작업이 끝나야 동작한다.

CREATE TABLE IF NOT EXISTS `brand_kits` (
    `id`            BIGINT AUTO_INCREMENT PRIMARY KEY,
    -- 외부(API·URL)에 노출하는 식별자. 내부 id를 그대로 드러내지 않기 위한 UUID
    `public_id`     VARCHAR(36)  NOT NULL UNIQUE,
    -- 어떤 로고 후보로 만들었나
    `candidate_id`  BIGINT       NOT NULL,
    -- 'BUSINESS_CARD'(명함, CI용) | 'BOTTLE'(로션병, BI용)
    `kit_type`      VARCHAR(20)  NOT NULL,
    -- QUEUED(대기) -> RUNNING(생성중) -> SUCCEEDED(완료) | FAILED(실패)
    `status`        VARCHAR(20)  NOT NULL DEFAULT 'QUEUED',
    -- 완성된 이미지 파일 경로. 완료 전에는 NULL
    `storage_key`   VARCHAR(500) NULL,
    -- 실패했을 때만 채워진다. 왜 실패했는지 추적하는 용도
    `error_code`    VARCHAR(50)  NULL,
    `error_message` TEXT         NULL,
    `started_at`    DATETIME     NULL,
    `completed_at`  DATETIME     NULL,
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_kit_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `logo_candidates`(`id`) ON DELETE CASCADE,
    CONSTRAINT `chk_kit_type` CHECK (`kit_type` IN ('BUSINESS_CARD', 'BOTTLE')),
    -- 한 로고에 대한 브랜드킷 목록 조회용
    INDEX `idx_kit_candidate` (`candidate_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
