ALTER TABLE member_surveys
    ADD COLUMN rating TINYINT NULL AFTER credited,
    ADD COLUMN improvements_json TEXT NULL AFTER rating,
    ADD COLUMN comment VARCHAR(500) NULL AFTER improvements_json,
    ADD COLUMN survey_version SMALLINT NOT NULL DEFAULT 1 AFTER comment,
    ADD CONSTRAINT chk_survey_rating CHECK (rating IS NULL OR rating IN (1, 5));
