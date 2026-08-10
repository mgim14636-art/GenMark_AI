-- Disposable local-db schema only. Production changes must use Flyway V1-V7.
CREATE DATABASE IF NOT EXISTS `genmark_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `genmark_db`;

CREATE TABLE IF NOT EXISTS members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    provider VARCHAR(20) NOT NULL DEFAULT 'local',
    provider_id VARCHAR(100) NULL,
    refresh_token_hash VARCHAR(128) NULL,
    refresh_token_expires_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_member_provider_provider_id UNIQUE (provider, provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ci_project (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(36) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    current_step TINYINT NOT NULL DEFAULT 1,
    industry VARCHAR(100) NOT NULL,
    company_name VARCHAR(150) NULL,
    core_values VARCHAR(300) NULL,
    tone VARCHAR(100) NOT NULL DEFAULT 'friendly',
    color_1 VARCHAR(7) NOT NULL,
    color_2 VARCHAR(7) NOT NULL,
    color_3 VARCHAR(7) NULL,
    color_4 VARCHAR(7) NULL,
    logo_style VARCHAR(50) NOT NULL DEFAULT 'combination',
    additional_requirements VARCHAR(300) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ci_project_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
    INDEX idx_ci_project_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bi_project (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(36) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    current_step TINYINT NOT NULL DEFAULT 1,
    industry VARCHAR(100) NOT NULL,
    brand_name VARCHAR(150) NULL,
    value_category_1 VARCHAR(50) NULL,
    value_category_2 VARCHAR(50) NULL,
    value_category_3 VARCHAR(50) NULL,
    brand_description VARCHAR(300) NULL,
    target_age VARCHAR(20) NOT NULL DEFAULT '전 연령층',
    tone VARCHAR(100) NOT NULL DEFAULT 'friendly',
    color_1 VARCHAR(7) NOT NULL,
    color_2 VARCHAR(7) NOT NULL,
    color_3 VARCHAR(7) NULL,
    color_4 VARCHAR(7) NULL,
    logo_style VARCHAR(50) NOT NULL DEFAULT 'combination',
    additional_requirements VARCHAR(300) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_bi_project_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
    INDEX idx_bi_project_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_onboardings (
    member_id BIGINT PRIMARY KEY,
    usage_1 VARCHAR(100) NOT NULL,
    usage_2 VARCHAR(100) NULL,
    usage_3 VARCHAR(100) NULL,
    audience VARCHAR(100) NOT NULL,
    details_decision VARCHAR(20) NOT NULL,
    completed_at DATETIME NOT NULL,
    schema_version INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_onboarding_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logo_generations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(36) NOT NULL UNIQUE,
    ci_project_id BIGINT NULL,
    bi_project_id BIGINT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    model_name VARCHAR(100) NULL,
    request_snapshot_json TEXT NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    error_code VARCHAR(50) NULL,
    error_message TEXT NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_generation_ci_project FOREIGN KEY (ci_project_id) REFERENCES ci_project(id) ON DELETE CASCADE,
    CONSTRAINT fk_generation_bi_project FOREIGN KEY (bi_project_id) REFERENCES bi_project(id) ON DELETE CASCADE,
    CONSTRAINT chk_generation_project_exclusive CHECK (
        (ci_project_id IS NOT NULL AND bi_project_id IS NULL) OR
        (ci_project_id IS NULL AND bi_project_id IS NOT NULL)
    ),
    CONSTRAINT uq_ci_generation_idempotency UNIQUE (ci_project_id, idempotency_key),
    CONSTRAINT uq_bi_generation_idempotency UNIQUE (bi_project_id, idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logo_candidates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(36) NOT NULL UNIQUE,
    generation_id BIGINT NOT NULL,
    candidate_order INT NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(50) NOT NULL DEFAULT 'image/png',
    width INT NULL,
    height INT NULL,
    selected BOOLEAN NOT NULL DEFAULT FALSE,
    saved BOOLEAN NOT NULL DEFAULT FALSE,
    ai_metadata_json TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_candidate_generation FOREIGN KEY (generation_id) REFERENCES logo_generations(id) ON DELETE CASCADE,
    CONSTRAINT uq_candidate_order UNIQUE (generation_id, candidate_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trademark_analyses (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(36) NOT NULL UNIQUE,
    candidate_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    max_similarity INT NULL,
    risk_level VARCHAR(20) NULL,
    disclaimer TEXT NULL,
    error_code VARCHAR(50) NULL,
    error_message TEXT NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_analysis_candidate FOREIGN KEY (candidate_id) REFERENCES logo_candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trademark_matches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    analysis_id BIGINT NOT NULL,
    match_rank INT NOT NULL,
    application_number VARCHAR(100) NULL,
    name VARCHAR(255) NULL,
    category VARCHAR(100) NULL,
    similarity INT NOT NULL,
    image_path VARCHAR(500) NULL,
    CONSTRAINT fk_match_analysis FOREIGN KEY (analysis_id) REFERENCES trademark_analyses(id) ON DELETE CASCADE,
    CONSTRAINT uq_match_rank UNIQUE (analysis_id, match_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

