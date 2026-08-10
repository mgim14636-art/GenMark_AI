-- Sample initial seed data for development

USE `genmark_db`;

-- Sample Member
-- password / role 컬럼은 V8 마이그레이션에서 제거됐다. 로그인은 소셜 로그인만 지원하므로
-- 이 시드 회원으로는 실제 로그인이 불가능하다 (프로젝트 등 하위 데이터의 FK 용도).
INSERT INTO `members` (`id`, `email`, `name`) VALUES
(1, 'admin@genmark.ai', 'Admin User'),
(2, 'user@genmark.ai', 'Test User')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- Sample Project
INSERT INTO `projects` (`id`, `public_id`, `member_id`, `status`, `title`, `description`) VALUES
(1, '00000000-0000-0000-0000-000000000001', 2, 'DRAFT', 'GenMark AI Branding', 'Project for AI Generated Logo Testing')
ON DUPLICATE KEY UPDATE `id`=`id`;
