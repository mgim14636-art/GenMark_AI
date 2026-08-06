-- Database schema definition for GenMark-AI

CREATE DATABASE IF NOT EXISTS `genmark_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `genmark_db`;

-- Member Table
CREATE TABLE IF NOT EXISTS `members` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `password` VARCHAR(255) NULL,
    `name` VARCHAR(50) NOT NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'ROLE_USER',
    `provider` VARCHAR(20) NOT NULL DEFAULT 'local',
    `provider_id` VARCHAR(100) NULL,
    `refresh_token_hash` VARCHAR(128) NULL,
    `refresh_token_expires_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `uq_member_provider_provider_id` UNIQUE (`provider`, `provider_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- 로그인(카카오/구글/로컬) 기능 전용. 다른 기능 테이블은 기능 구현 시점에 추가한다.
