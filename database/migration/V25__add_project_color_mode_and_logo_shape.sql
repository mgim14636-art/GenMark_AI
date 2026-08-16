ALTER TABLE ci_project
    ADD COLUMN color_mode VARCHAR(20) NULL AFTER tone,
    ADD COLUMN logo_shape VARCHAR(100) NULL AFTER logo_style;

ALTER TABLE bi_project
    ADD COLUMN color_mode VARCHAR(20) NULL AFTER tone,
    ADD COLUMN logo_shape VARCHAR(100) NULL AFTER logo_style;

-- Before V25 every saved palette was sent to the AI as MANUAL. Preserve that
-- behavior for existing projects; only projects without saved colors use TONE.
UPDATE ci_project
SET color_mode = CASE
    WHEN color_1 IS NOT NULL OR color_2 IS NOT NULL OR color_3 IS NOT NULL OR color_4 IS NOT NULL
        THEN 'MANUAL'
    ELSE 'TONE'
END;

UPDATE bi_project
SET color_mode = CASE
    WHEN color_1 IS NOT NULL OR color_2 IS NOT NULL OR color_3 IS NOT NULL OR color_4 IS NOT NULL
        THEN 'MANUAL'
    ELSE 'TONE'
END;

ALTER TABLE ci_project
    MODIFY COLUMN color_mode VARCHAR(20) NOT NULL DEFAULT 'TONE',
    ADD CONSTRAINT chk_ci_color_mode CHECK (color_mode IN ('TONE', 'MANUAL'));

ALTER TABLE bi_project
    MODIFY COLUMN color_mode VARCHAR(20) NOT NULL DEFAULT 'TONE',
    ADD CONSTRAINT chk_bi_color_mode CHECK (color_mode IN ('TONE', 'MANUAL'));
