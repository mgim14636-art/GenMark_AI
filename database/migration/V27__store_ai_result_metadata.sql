ALTER TABLE trademark_matches
    ADD COLUMN note TEXT NULL AFTER image_path;

ALTER TABLE brand_kits
    ADD COLUMN preliminary BOOLEAN NOT NULL DEFAULT FALSE AFTER storage_key,
    ADD COLUMN warnings_json TEXT NULL AFTER preliminary;
