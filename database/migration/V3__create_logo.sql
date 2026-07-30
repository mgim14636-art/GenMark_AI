CREATE TABLE IF NOT EXISTS `generated_logos` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `project_id` BIGINT NOT NULL,
    `prompt` TEXT NOT NULL,
    `image_url` VARCHAR(255) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_logo_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `similarity_results` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `logo_id` BIGINT NOT NULL,
    `matched_trademark_id` VARCHAR(100) NOT NULL,
    `matched_trademark_name` VARCHAR(100),
    `similarity_score` FLOAT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_similarity_logo` FOREIGN KEY (`logo_id`) REFERENCES `generated_logos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
