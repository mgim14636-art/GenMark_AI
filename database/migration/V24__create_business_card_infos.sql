-- V24: Save the exact contact information used for each business-card generation.
CREATE TABLE IF NOT EXISTS `business_card_infos` (
    `brand_kit_id` BIGINT PRIMARY KEY,
    `name`         VARCHAR(40)  NOT NULL,
    `title`        VARCHAR(40)  NULL,
    `company`      VARCHAR(60)  NULL,
    `phone`        VARCHAR(40)  NULL,
    `email`        VARCHAR(80)  NULL,
    `address`      VARCHAR(120) NULL,
    `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_business_card_info_kit`
        FOREIGN KEY (`brand_kit_id`) REFERENCES `brand_kits`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
