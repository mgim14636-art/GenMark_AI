-- Disposable local-db schema only. Production changes must use Flyway V1-V25.
CREATE DATABASE IF NOT EXISTS `genmark_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `genmark_db`;

CREATE TABLE IF NOT EXISTS members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    provider VARCHAR(20) NOT NULL DEFAULT 'local',
    provider_id VARCHAR(100) NULL,
    credit_balance INT NOT NULL DEFAULT 2,
    refresh_token_hash VARCHAR(128) NULL,
    refresh_token_expires_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_member_provider_provider_id UNIQUE (provider, provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    login_id VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
    color_mode VARCHAR(20) NOT NULL DEFAULT 'TONE',
    color_1 VARCHAR(7) NULL,
    color_2 VARCHAR(7) NULL,
    color_3 VARCHAR(7) NULL,
    color_4 VARCHAR(7) NULL,
    logo_style VARCHAR(50) NOT NULL DEFAULT 'combination',
    logo_shape VARCHAR(100) NULL,
    additional_requirements VARCHAR(300) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_ci_project_status CHECK (status IN ('DRAFT', 'BRIEF_READY', 'GENERATING', 'RESULT_READY', 'ANALYZING', 'COMPLETED')),
    CONSTRAINT chk_ci_current_step CHECK (current_step BETWEEN 1 AND 5),
    CONSTRAINT chk_ci_color_mode CHECK (color_mode IN ('TONE', 'MANUAL')),
    CONSTRAINT chk_ci_color_1 CHECK (color_1 IS NULL OR color_1 REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_ci_color_2 CHECK (color_2 IS NULL OR color_2 REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_ci_color_3 CHECK (color_3 IS NULL OR color_3 REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_ci_color_4 CHECK (color_4 IS NULL OR color_4 REGEXP '^#[0-9A-Fa-f]{6}$'),
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
    color_mode VARCHAR(20) NOT NULL DEFAULT 'TONE',
    color_1 VARCHAR(7) NULL,
    color_2 VARCHAR(7) NULL,
    color_3 VARCHAR(7) NULL,
    color_4 VARCHAR(7) NULL,
    logo_style VARCHAR(50) NOT NULL DEFAULT 'combination',
    logo_shape VARCHAR(100) NULL,
    additional_requirements VARCHAR(300) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_bi_project_status CHECK (status IN ('DRAFT', 'BRIEF_READY', 'GENERATING', 'RESULT_READY', 'ANALYZING', 'COMPLETED')),
    CONSTRAINT chk_bi_current_step CHECK (current_step BETWEEN 1 AND 6),
    CONSTRAINT chk_bi_target_age CHECK (target_age IN ('10~20', '30~40', '50~60', '전 연령층')),
    CONSTRAINT chk_bi_color_mode CHECK (color_mode IN ('TONE', 'MANUAL')),
    CONSTRAINT chk_bi_color_1 CHECK (color_1 IS NULL OR color_1 REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_bi_color_2 CHECK (color_2 IS NULL OR color_2 REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_bi_color_3 CHECK (color_3 IS NULL OR color_3 REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_bi_color_4 CHECK (color_4 IS NULL OR color_4 REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT fk_bi_project_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
    INDEX idx_bi_project_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_onboardings (
    member_id BIGINT PRIMARY KEY,
    usage_1 VARCHAR(100) NOT NULL,
    usage_2 VARCHAR(100) NULL,
    usage_3 VARCHAR(100) NULL,
    audience VARCHAR(100) NOT NULL,
    completed_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_onboarding_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_surveys (
    member_id BIGINT PRIMARY KEY,
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    credited BOOLEAN NOT NULL DEFAULT FALSE,
    rating TINYINT NULL,
    improvements_json TEXT NULL,
    comment VARCHAR(500) NULL,
    survey_version SMALLINT NOT NULL DEFAULT 1,
    CONSTRAINT chk_survey_rating CHECK (rating IS NULL OR rating IN (1, 5)),
    CONSTRAINT fk_survey_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_histories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    amount INT NOT NULL,
    reason VARCHAR(30) NOT NULL,
    balance_after INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_credit_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    INDEX idx_credit_member_time (member_id, created_at)
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
    parent_generation_id BIGINT NULL,
    error_code VARCHAR(50) NULL,
    error_message TEXT NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_generation_ci_project FOREIGN KEY (ci_project_id) REFERENCES ci_project(id) ON DELETE CASCADE,
    CONSTRAINT fk_generation_bi_project FOREIGN KEY (bi_project_id) REFERENCES bi_project(id) ON DELETE CASCADE,
    CONSTRAINT fk_generation_parent FOREIGN KEY (parent_generation_id) REFERENCES logo_generations(id) ON DELETE SET NULL,
    CONSTRAINT chk_generation_project_exclusive CHECK (
        (ci_project_id IS NOT NULL AND bi_project_id IS NULL) OR
        (ci_project_id IS NULL AND bi_project_id IS NOT NULL)
    ),
    CONSTRAINT chk_generation_status CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
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
    pinned_at DATETIME NULL,
    ai_metadata_json TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_candidate_generation FOREIGN KEY (generation_id) REFERENCES logo_generations(id) ON DELETE CASCADE,
    CONSTRAINT uq_candidate_order UNIQUE (generation_id, candidate_order),
    CONSTRAINT chk_candidate_order CHECK (candidate_order BETWEEN 1 AND 4),
    INDEX idx_candidate_pinned (pinned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logo_downloads (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    candidate_id BIGINT NOT NULL,
    -- 수정본마다 다른 값. 한 번도 수정하지 않은 원본은 'original'.
    asset_revision VARCHAR(64) NOT NULL DEFAULT 'original',
    project_type VARCHAR(2) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    downloaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_download_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT fk_download_candidate FOREIGN KEY (candidate_id) REFERENCES logo_candidates(id) ON DELETE CASCADE,
    CONSTRAINT uq_download_member_candidate_revision UNIQUE (member_id, candidate_id, asset_revision),
    CONSTRAINT chk_download_project_type CHECK (project_type IN ('CI', 'BI')),
    INDEX idx_download_member_type_time (member_id, project_type, downloaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mypage_hidden_logo_assets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    candidate_id BIGINT NOT NULL,
    hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mypage_hidden_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT fk_mypage_hidden_candidate FOREIGN KEY (candidate_id) REFERENCES logo_candidates(id) ON DELETE CASCADE,
    CONSTRAINT uq_mypage_hidden_member_candidate UNIQUE (member_id, candidate_id),
    INDEX idx_mypage_hidden_member_time (member_id, hidden_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brand_kits (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(36) NOT NULL UNIQUE,
    candidate_id BIGINT NOT NULL,
    kit_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    storage_key VARCHAR(500) NULL,
    render_spec_json TEXT NULL,
    render_spec_hash CHAR(64) NULL,
    preliminary BOOLEAN NOT NULL DEFAULT FALSE,
    warnings_json TEXT NULL,
    error_code VARCHAR(50) NULL,
    error_message TEXT NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_kit_candidate FOREIGN KEY (candidate_id) REFERENCES logo_candidates(id) ON DELETE CASCADE,
    CONSTRAINT chk_kit_type CHECK (kit_type IN ('BUSINESS_CARD', 'THUMBNAIL')),
    INDEX idx_kit_render_spec (candidate_id, kit_type, render_spec_hash, status),
    INDEX idx_kit_candidate (candidate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS business_card_infos (
    brand_kit_id BIGINT PRIMARY KEY,
    name VARCHAR(40) NOT NULL,
    title VARCHAR(40) NULL,
    company VARCHAR(60) NULL,
    phone VARCHAR(40) NULL,
    email VARCHAR(80) NULL,
    address VARCHAR(120) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_business_card_info_kit FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE CASCADE
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
    CONSTRAINT fk_analysis_candidate FOREIGN KEY (candidate_id) REFERENCES logo_candidates(id) ON DELETE CASCADE,
    CONSTRAINT chk_analysis_status CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
    CONSTRAINT chk_analysis_similarity CHECK (max_similarity IS NULL OR max_similarity BETWEEN 0 AND 100),
    CONSTRAINT chk_analysis_risk CHECK (risk_level IS NULL OR risk_level IN ('SAFE', 'MODERATE', 'CAUTION'))
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
    note TEXT NULL,
    CONSTRAINT fk_match_analysis FOREIGN KEY (analysis_id) REFERENCES trademark_analyses(id) ON DELETE CASCADE,
    CONSTRAINT uq_match_rank UNIQUE (analysis_id, match_rank),
    CONSTRAINT chk_match_similarity CHECK (similarity BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
