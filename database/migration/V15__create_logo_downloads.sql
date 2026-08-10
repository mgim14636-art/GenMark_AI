-- V15: 로고 다운로드 기록 테이블(logo_downloads) 생성
--
-- 배경
-- - 관리자 회원관리의 "다운로드 횟수"와 통계 화면의 "사용자별 다운로드 목록"이 모두
--   이 테이블을 근거로 한다.
-- - 저장 공간을 아끼기 위해 "다운로드한 로고만" 서버에 보관한다. 생성만 하고 받지 않은
--   로고는 보관 대상이 아니다. storage_key가 그 보관 파일의 경로다.
--
-- UNIQUE (member_id, candidate_id) 가 하는 일
-- - 같은 사람이 같은 로고를 두 번 받아도 새 행이 생기지 않는다. 즉 "중복 다운로드는 1회로
--   집계한다"는 요구사항을 DB가 직접 보장한다. 자바 코드에서 따로 검사할 필요가 없다.
--
-- project_type 컬럼과 인덱스 순서
-- - 통계 보관 한도가 "CI 20개 + BI 20개"로 각각 관리된다. 한도 초과분을 지울 때 항상
--   member_id + project_type 으로 세게 되므로 인덱스도 그 순서로 만든다.
--   (member_id, downloaded_at)만 있으면 project_type 조건에서 인덱스를 못 타 느려진다.
-- - 값은 'CI' 또는 'BI' 두 가지뿐이다. logo_candidates를 거슬러 올라가면 알아낼 수 있지만,
--   조인 없이 바로 걸러내기 위해 비정규화해서 들고 있는다.

CREATE TABLE IF NOT EXISTS `logo_downloads` (
    `id`            BIGINT AUTO_INCREMENT PRIMARY KEY,
    `member_id`     BIGINT       NOT NULL,
    `candidate_id`  BIGINT       NOT NULL,
    -- 'CI' 또는 'BI'. 통계 화면이 목록을 둘로 나누고 보관 한도도 각각 세기 때문에 필요하다
    `project_type`  VARCHAR(2)   NOT NULL,
    -- 보관 중인 이미지 파일 경로 (uploads 디렉터리 기준 상대 경로)
    `storage_key`   VARCHAR(500) NOT NULL,
    `downloaded_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_download_member` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_download_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `logo_candidates`(`id`) ON DELETE CASCADE,
    -- 같은 로고를 또 받아도 1회로 유지시키는 장치
    CONSTRAINT `uq_download_member_candidate` UNIQUE (`member_id`, `candidate_id`),
    CONSTRAINT `chk_download_project_type` CHECK (`project_type` IN ('CI', 'BI')),
    -- CI 20 / BI 20 한도 정리를 빠르게 하기 위한 인덱스
    INDEX `idx_download_member_type_time` (`member_id`, `project_type`, `downloaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
