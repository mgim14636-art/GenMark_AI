-- V18: 설문조사 응답 테이블(member_surveys) 생성
--
-- 배경
-- - 설문조사에 응한 사용자에게 크레딧 2개를 추가로 지급한다. 따라서 "누가 응답했는지"와
--   "지급이 실제로 처리됐는지"를 기록해야 한다.
--
-- member_id를 기본키로 둔 이유
-- - 회원당 1행만 존재할 수 있게 만든다. 한 사람이 설문을 여러 번 제출해서 크레딧을 반복
--   수령하는 것을 DB가 직접 막아준다. 애플리케이션 코드의 중복 검사에 의존하지 않는다.
-- - member_onboardings 테이블도 같은 방식(회원당 1행)이라 구조가 일관된다.
--
-- credited 컬럼
-- - 응답 기록과 크레딧 지급은 같은 트랜잭션에서 처리하지만, 만약 지급 단계에서 문제가 생기면
--   "응답은 했는데 아직 못 받은 사람"을 이 값으로 찾아낼 수 있다.
--
-- 설문 문항과 답변 내용은 아직 정해지지 않았다. 답변까지 저장하게 되면
-- answers_json TEXT 컬럼을 추가하는 마이그레이션을 별도로 만든다.

CREATE TABLE IF NOT EXISTS `member_surveys` (
    -- 회원당 1회만 응답 가능 (기본키 = 중복 제출 차단)
    `member_id`    BIGINT   PRIMARY KEY,
    `completed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 크레딧 2개를 실제로 지급했는지 여부
    `credited`     BOOLEAN  NOT NULL DEFAULT FALSE,
    CONSTRAINT `fk_survey_member` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
