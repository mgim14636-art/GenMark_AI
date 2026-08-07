CREATE TABLE logo_generations (
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
    CONSTRAINT uq_logo_generation_idempotency UNIQUE (project_id, idempotency_key),
    CONSTRAINT chk_generation_status CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'))
);

CREATE TABLE logo_candidates (
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
    CONSTRAINT uq_candidate_order UNIQUE (generation_id, candidate_order),
    CONSTRAINT chk_candidate_order CHECK (candidate_order BETWEEN 1 AND 4)
);
