-- 생성 로고 원본은 유지하면서 마이페이지 자산 목록에서만 제외한다.
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
