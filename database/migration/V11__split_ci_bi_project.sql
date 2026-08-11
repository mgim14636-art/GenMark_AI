-- Replace the single `projects` table with ci_project / bi_project.
-- logo_generations now points at whichever one owns it (ci_project_id XOR bi_project_id).
-- trademark_analyses drops its redundant project_id (derivable via candidate -> generation -> project).
-- generated_logos / similarity_results are unused legacy tables (no backing Java code) and are dropped too.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS trademark_matches;
DROP TABLE IF EXISTS trademark_analyses;
DROP TABLE IF EXISTS similarity_results;
DROP TABLE IF EXISTS logo_candidates;
DROP TABLE IF EXISTS logo_generations;
DROP TABLE IF EXISTS generated_logos;
DROP TABLE IF EXISTS projects;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE ci_project (
    id                       BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id                VARCHAR(36)  NOT NULL UNIQUE,
    member_id                BIGINT       NOT NULL,
    status                   VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    current_step             TINYINT      NOT NULL DEFAULT 1,
    industry                 VARCHAR(100) NOT NULL,
    company_name             VARCHAR(150) NULL,
    core_values              VARCHAR(300) NULL,
    tone                     VARCHAR(100) NOT NULL DEFAULT 'friendly',
    color_1                  VARCHAR(7)   NOT NULL,
    color_2                  VARCHAR(7)   NOT NULL,
    color_3                  VARCHAR(7)   NULL,
    color_4                  VARCHAR(7)   NULL,
    logo_style               VARCHAR(50)  NOT NULL DEFAULT 'combination',
    additional_requirements  VARCHAR(300) NULL,
    created_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ci_project_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
    CONSTRAINT chk_ci_project_status CHECK (status IN ('DRAFT', 'BRIEF_READY', 'GENERATING', 'RESULT_READY', 'ANALYZING', 'COMPLETED')),
    CONSTRAINT chk_ci_current_step CHECK (current_step BETWEEN 1 AND 4),
    CONSTRAINT chk_ci_color_1 CHECK (color_1 REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_ci_color_2 CHECK (color_2 REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_ci_color_3 CHECK (color_3 IS NULL OR color_3 REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_ci_color_4 CHECK (color_4 IS NULL OR color_4 REGEXP '^#[0-9A-Fa-f]{6}$'),
    INDEX idx_ci_project_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bi_project (
    id                       BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id                VARCHAR(36)  NOT NULL UNIQUE,
    member_id                BIGINT       NOT NULL,
    status                   VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    current_step             TINYINT      NOT NULL DEFAULT 1,
    industry                 VARCHAR(100) NOT NULL,
    brand_name               VARCHAR(150) NULL,
    value_category_1         VARCHAR(50)  NULL,
    value_category_2         VARCHAR(50)  NULL,
    value_category_3         VARCHAR(50)  NULL,
    brand_description        VARCHAR(300) NULL,
    target_age               VARCHAR(20)  NOT NULL DEFAULT '전 연령층',
    tone                     VARCHAR(100) NOT NULL DEFAULT 'friendly',
    color_1                  VARCHAR(7)   NOT NULL,
    color_2                  VARCHAR(7)   NOT NULL,
    color_3                  VARCHAR(7)   NULL,
    color_4                  VARCHAR(7)   NULL,
    logo_style               VARCHAR(50)  NOT NULL DEFAULT 'combination',
    additional_requirements  VARCHAR(300) NULL,
    created_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_bi_project_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT,
    CONSTRAINT chk_bi_project_status CHECK (status IN ('DRAFT', 'BRIEF_READY', 'GENERATING', 'RESULT_READY', 'ANALYZING', 'COMPLETED')),
    CONSTRAINT chk_bi_current_step CHECK (current_step BETWEEN 1 AND 5),
    CONSTRAINT chk_bi_target_age CHECK (target_age IN ('10~20', '30~40', '50~60', '전 연령층')),
    CONSTRAINT chk_bi_color_1 CHECK (color_1 REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_bi_color_2 CHECK (color_2 REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_bi_color_3 CHECK (color_3 IS NULL OR color_3 REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_bi_color_4 CHECK (color_4 IS NULL OR color_4 REGEXP '^#[0-9A-Fa-f]{6}$'),
    INDEX idx_bi_project_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE logo_generations (
    id                       BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id                VARCHAR(36)  NOT NULL UNIQUE,
    ci_project_id            BIGINT       NULL,
    bi_project_id            BIGINT       NULL,
    status                   VARCHAR(20)  NOT NULL DEFAULT 'QUEUED',
    model_name               VARCHAR(100) NULL,
    request_snapshot_json    TEXT         NOT NULL,
    idempotency_key          VARCHAR(100) NOT NULL,
    error_code               VARCHAR(50)  NULL,
    error_message            TEXT         NULL,
    started_at               DATETIME     NULL,
    completed_at             DATETIME     NULL,
    created_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_generation_ci_project FOREIGN KEY (ci_project_id) REFERENCES ci_project(id) ON DELETE CASCADE,
    CONSTRAINT fk_generation_bi_project FOREIGN KEY (bi_project_id) REFERENCES bi_project(id) ON DELETE CASCADE,
    CONSTRAINT chk_generation_project_exclusive CHECK (
        (ci_project_id IS NOT NULL AND bi_project_id IS NULL) OR
        (ci_project_id IS NULL AND bi_project_id IS NOT NULL)
    ),
    CONSTRAINT uq_ci_generation_idempotency UNIQUE (ci_project_id, idempotency_key),
    CONSTRAINT uq_bi_generation_idempotency UNIQUE (bi_project_id, idempotency_key),
    CONSTRAINT chk_generation_status CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE logo_candidates (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id         VARCHAR(36)  NOT NULL UNIQUE,
    generation_id     BIGINT       NOT NULL,
    candidate_order   INT          NOT NULL,
    storage_key       VARCHAR(500) NOT NULL,
    mime_type         VARCHAR(50)  NOT NULL DEFAULT 'image/png',
    width             INT          NULL,
    height            INT          NULL,
    selected          BOOLEAN      NOT NULL DEFAULT FALSE,
    saved             BOOLEAN      NOT NULL DEFAULT FALSE,
    ai_metadata_json  TEXT         NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_candidate_generation FOREIGN KEY (generation_id) REFERENCES logo_generations(id) ON DELETE CASCADE,
    CONSTRAINT uq_candidate_order UNIQUE (generation_id, candidate_order),
    CONSTRAINT chk_candidate_order CHECK (candidate_order BETWEEN 1 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trademark_analyses (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id         VARCHAR(36)  NOT NULL UNIQUE,
    candidate_id      BIGINT       NOT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'QUEUED',
    max_similarity    INT          NULL,
    risk_level        VARCHAR(20)  NULL,
    disclaimer        TEXT         NULL,
    error_code        VARCHAR(50)  NULL,
    error_message     TEXT         NULL,
    started_at        DATETIME     NULL,
    completed_at      DATETIME     NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_analysis_candidate FOREIGN KEY (candidate_id) REFERENCES logo_candidates(id) ON DELETE CASCADE,
    CONSTRAINT chk_analysis_status CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
    CONSTRAINT chk_analysis_similarity CHECK (max_similarity IS NULL OR max_similarity BETWEEN 0 AND 100),
    CONSTRAINT chk_analysis_risk CHECK (risk_level IS NULL OR risk_level IN ('SAFE', 'MODERATE', 'CAUTION'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trademark_matches (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    analysis_id         BIGINT       NOT NULL,
    match_rank          INT          NOT NULL,
    application_number  VARCHAR(100) NULL,
    name                VARCHAR(255) NULL,
    category            VARCHAR(100) NULL,
    similarity          INT          NOT NULL,
    image_path          VARCHAR(500) NULL,
    CONSTRAINT fk_match_analysis FOREIGN KEY (analysis_id) REFERENCES trademark_analyses(id) ON DELETE CASCADE,
    CONSTRAINT uq_match_rank UNIQUE (analysis_id, match_rank),
    CONSTRAINT chk_match_similarity CHECK (similarity BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
