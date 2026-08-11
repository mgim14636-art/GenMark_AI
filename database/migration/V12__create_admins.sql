-- V12: 관리자 계정 테이블(admins) 생성
--
-- 배경
-- - V8에서 members.role 컬럼을 지우면서 "누가 관리자인가"를 판별할 수단이 사라졌다.
--   V8 주석에 적힌 "관리자/일반 구분이 필요해지면 그때 별도 테이블로 다시 설계한다"를 이행한다.
-- - 관리자는 일반 회원(members)과 완전히 분리한다. 일반 회원은 소셜 로그인만 쓰고 비밀번호가
--   없지만, 관리자는 아이디/비밀번호로 로그인하기 때문에 한 테이블에 섞으면 구조가 지저분해진다.
-- - 관리자 회원가입 화면은 만들지 않는다. 계정은 이 테이블에 직접 INSERT로 넣는다.
--
-- password_hash 주의
-- - 비밀번호 원문을 그대로 넣으면 안 된다. BCrypt로 암호화한 문자열($2a$... 형태)을 넣어야 한다.
--   해시 생성 방법은 작업 내용 .md 문서를 참고할 것.
-- - BCrypt 결과는 60자지만, 나중에 다른 알고리즘으로 바꿀 여지를 두려고 255자로 잡았다.

CREATE TABLE IF NOT EXISTS `admins` (
    `id`            BIGINT AUTO_INCREMENT PRIMARY KEY,
    -- 관리자 로그인 아이디. 이메일이 아니어도 된다 (예: 'admin')
    `login_id`      VARCHAR(50)  NOT NULL UNIQUE,
    -- BCrypt 등으로 암호화된 비밀번호. 평문 저장 금지
    `password_hash` VARCHAR(255) NOT NULL,
    -- 관리자 화면에 표시할 이름
    `name`          VARCHAR(50)  NOT NULL,
    -- 마지막으로 로그인에 성공한 시각. 미로그인 계정은 NULL
    `last_login_at` DATETIME     NULL,
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
