-- Sample initial seed data for development

USE `genmark_db`;

-- Sample Member (Password: password123 encoded with BCrypt)
INSERT INTO `members` (`id`, `email`, `password`, `name`, `role`) VALUES
(1, 'admin@genmark.ai', '$2a$10$E2b7bC3K3O6C6F7G8H9I0.J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y', 'Admin User', 'ROLE_ADMIN'),
(2, 'user@genmark.ai', '$2a$10$E2b7bC3K3O6C6F7G8H9I0.J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y', 'Test User', 'ROLE_USER')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- Sample Project
INSERT INTO `projects` (`id`, `public_id`, `member_id`, `status`, `title`, `description`) VALUES
(1, '00000000-0000-0000-0000-000000000001', 2, 'DRAFT', 'GenMark AI Branding', 'Project for AI Generated Logo Testing')
ON DUPLICATE KEY UPDATE `id`=`id`;
