ALTER TABLE brand_kits
    ADD COLUMN render_spec_json TEXT NULL AFTER storage_key,
    ADD COLUMN render_spec_hash CHAR(64) NULL AFTER render_spec_json,
    ADD INDEX idx_kit_render_spec (candidate_id, kit_type, render_spec_hash, status);
