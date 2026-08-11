-- V14: 크레딧 증감 이력 테이블(credit_histories) 생성
--
-- 배경
-- - V13의 members.credit_balance만 있어도 기능은 동작한다. 하지만 잔액만 남기면
--   "크레딧이 왜 이만큼 남았지?"를 추적할 방법이 없다. 사용자 문의나 차감 버그가 생겼을 때
--   원인을 찾으려면 증감 한 건 한 건이 기록되어 있어야 한다.
-- - 그래서 잔액(members.credit_balance)과 이력(이 테이블)을 함께 둔다.
--   이력을 모두 더하면 잔액과 같아야 하므로, 어긋나면 버그를 바로 알 수 있다.
--
-- amount 부호 규칙
-- - 지급은 양수(+2), 차감은 음수(-1)로 넣는다. 절댓값만 넣고 종류를 따로 두는 방식보다
--   합계 계산(SUM)이 그대로 잔액이 되어 검증이 쉽다.
--
-- reason 값
-- - SIGNUP   : 가입 시 지급 (+2)
-- - SURVEY   : 설문조사 응답 보상 (+2)
-- - GENERATE : 로고 생성 시 차감
-- - DOWNLOAD : 다운로드 시 차감
--   차감 시점이 생성/다운로드 중 어디로 정해질지 아직 미확정이라 두 값을 모두 준비해 둔다.
--   나중에 어느 쪽으로 정해도 테이블 구조는 바꿀 필요가 없다.
--
-- balance_after
-- - 이 변동이 반영된 직후의 잔액을 함께 저장한다. 나중에 정책이 바뀌어 과거 계산식이 달라져도
--   "그때 그 시점의 잔액"을 그대로 읽을 수 있다.

CREATE TABLE IF NOT EXISTS `credit_histories` (
    `id`            BIGINT AUTO_INCREMENT PRIMARY KEY,
    `member_id`     BIGINT      NOT NULL,
    -- 지급은 +, 차감은 - (예: +2, -1)
    `amount`        INT         NOT NULL,
    -- SIGNUP | SURVEY | GENERATE | DOWNLOAD
    `reason`        VARCHAR(30) NOT NULL,
    -- 이 변동 직후의 잔액 스냅샷
    `balance_after` INT         NOT NULL,
    `created_at`    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_credit_member` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE,
    -- 특정 회원의 이력을 최신순으로 뽑는 조회가 주 용도
    INDEX `idx_credit_member_time` (`member_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
