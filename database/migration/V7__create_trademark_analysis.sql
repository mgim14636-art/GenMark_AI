CREATE TABLE trademark_analyses (
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
    CONSTRAINT fk_analysis_candidate FOREIGN KEY (candidate_id) REFERENCES logo_candidates(id) ON DELETE CASCADE,
    CONSTRAINT chk_analysis_status CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
    CONSTRAINT chk_analysis_similarity CHECK (max_similarity IS NULL OR max_similarity BETWEEN 0 AND 100),
    CONSTRAINT chk_analysis_risk CHECK (risk_level IS NULL OR risk_level IN ('SAFE', 'MODERATE', 'CAUTION'))
);

CREATE TABLE trademark_matches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    analysis_id BIGINT NOT NULL,
    match_rank INT NOT NULL,
    application_number VARCHAR(100) NULL,
    name VARCHAR(255) NULL,
    category VARCHAR(100) NULL,
    similarity INT NOT NULL,
    image_path VARCHAR(500) NULL,
    CONSTRAINT fk_match_analysis FOREIGN KEY (analysis_id) REFERENCES trademark_analyses(id) ON DELETE CASCADE,
    CONSTRAINT uq_match_rank UNIQUE (analysis_id, match_rank),
    CONSTRAINT chk_match_similarity CHECK (similarity BETWEEN 0 AND 100)
);
