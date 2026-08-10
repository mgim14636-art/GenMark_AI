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

CREATE TABLE IF NOT EXISTS projects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(36) NOT NULL UNIQUE,
    member_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    title VARCHAR(100) NULL,
    description TEXT NULL,
    brand_type VARCHAR(50) NULL,
    industry VARCHAR(100) NULL,
    brand_name VARCHAR(150) NULL,
    company_name VARCHAR(150) NULL,
    company_motto VARCHAR(255) NULL,
    brand_values_json TEXT NULL,
    brand_values_text TEXT NULL,
    target_age VARCHAR(50) NULL,
    tone VARCHAR(100) NULL,
    color_mode VARCHAR(30) NULL,
    colors_json TEXT NULL,
    logo_style VARCHAR(50) NULL,
    include_brand_name BOOLEAN NOT NULL DEFAULT TRUE,
    additional_requirements TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
    INDEX idx_projects_member (member_id),
    INDEX idx_projects_member_status (member_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_onboardings (
    member_id BIGINT PRIMARY KEY,
    usage_json TEXT NOT NULL,
    audience VARCHAR(100) NOT NULL,
    details_decision VARCHAR(20) NOT NULL,
    initial_project_id BIGINT NULL,
    completed_at DATETIME NOT NULL,
    schema_version INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_onboarding_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT fk_onboarding_project FOREIGN KEY (initial_project_id) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logo_generations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(36) NOT NULL UNIQUE,
    project_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    candidate_count INT NOT NULL DEFAULT 4,
    model_name VARCHAR(100) NULL,
    request_snapshot_json TEXT NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    error_code VARCHAR(50) NULL,
    error_message TEXT NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_generation_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT uq_logo_generation_idempotency UNIQUE (project_id, idempotency_key)
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
    project_id BIGINT NOT NULL,
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
    CONSTRAINT fk_analysis_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
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

-- Legacy tables remain only because the old Thymeleaf controllers/entities still exist.
CREATE TABLE IF NOT EXISTS generated_logos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    prompt TEXT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_logo_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS similarity_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    logo_id BIGINT NOT NULL,
    matched_trademark_id VARCHAR(100) NOT NULL,
    matched_trademark_name VARCHAR(100),
    similarity_score FLOAT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_similarity_logo FOREIGN KEY (logo_id) REFERENCES generated_logos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
