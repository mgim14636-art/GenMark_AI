-- Preserve members and OAuth/refresh-token data. Only non-member core tables are reset.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS trademark_matches;
DROP TABLE IF EXISTS trademark_analyses;
DROP TABLE IF EXISTS logo_candidates;
DROP TABLE IF EXISTS logo_generations;
DROP TABLE IF EXISTS member_onboardings;
DROP TABLE IF EXISTS similarity_results;
DROP TABLE IF EXISTS generated_logos;
DROP TABLE IF EXISTS projects;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE projects (
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
);

CREATE TABLE member_onboardings (
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
    CONSTRAINT fk_onboarding_project FOREIGN KEY (initial_project_id) REFERENCES projects(id) ON DELETE SET NULL,
    CONSTRAINT chk_onboarding_decision CHECK (details_decision IN ('SUBMITTED', 'SKIPPED'))
);

-- Temporary compatibility for the existing server-rendered controllers.
CREATE TABLE generated_logos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    prompt TEXT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_logo_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE similarity_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    logo_id BIGINT NOT NULL,
    matched_trademark_id VARCHAR(100) NOT NULL,
    matched_trademark_name VARCHAR(100),
    similarity_score FLOAT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_similarity_logo FOREIGN KEY (logo_id) REFERENCES generated_logos(id) ON DELETE CASCADE
);
