-- 로고 수정 기능이 생기면서 "같은 후보 = 같은 그림"이 더 이상 성립하지 않는다.
-- 수정 전/후를 각각 받으면 서로 다른 그림 두 장이므로 다운로드도 각각 기록해야 한다.
--
-- asset_revision에는 logo_candidates.ai_metadata_json.svgRevision 값을 넣고,
-- 아직 한 번도 수정하지 않은 원본은 'original'로 표시한다. NULL을 쓰지 않는 이유는
-- MariaDB의 UNIQUE 인덱스가 NULL끼리는 중복으로 보지 않아, 원본을 여러 번 받으면
-- 기록이 계속 늘어나기 때문이다(같은 그림 재다운로드는 1회여야 한다).
-- ⚠ 이 파일은 "한 줄씩, 각각 새 접속으로" 실행해야 한다. 아래 이유 때문이다.
--
-- chk_download_project_type가 내부적으로 깨져 있어(컬럼을 `ld1_0.project_type`이라는
-- 옛 별칭으로 들고 있다 — SHOW CREATE TABLE에는 정상으로 보이지만 ALTER 시 재검증에서
-- "Unknown column '...ld1_0.project_type' in 'CHECK'"로 실패한다) 이 테이블은 컬럼 추가가
-- 아예 안 된다. 같은 내용으로 다시 만들어야 정상화된다.
--
-- 게다가 MariaDB 10.11에서, 별칭을 쓴 UPDATE(예: UPDATE logo_downloads d JOIN ...)를 실행한
-- 뒤 같은 스크립트 안에서 CHECK를 다시 만들면 그 별칭(d)으로 또 깨진다. 그래서 아래
-- 순서(체크 제거 → 컬럼 추가 → 백필 → 인덱스 교체 → 체크 재생성)를 지키고,
-- 특히 마지막 CHECK 재생성은 반드시 깨끗한 새 접속에서 단독으로 실행한다.
ALTER TABLE logo_downloads DROP CONSTRAINT chk_download_project_type;

ALTER TABLE logo_downloads
    ADD COLUMN asset_revision VARCHAR(64) NOT NULL DEFAULT 'original' AFTER candidate_id;

-- 기존 기록은 "그 후보의 현재 리비전"을 받은 것으로 본다. 지금까지는 후보당 한 건만
-- 존재했으므로 이렇게 채워도 중복이 생기지 않는다.
UPDATE logo_downloads d
JOIN logo_candidates c ON c.id = d.candidate_id
SET d.asset_revision = COALESCE(
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.ai_metadata_json, '$.svgRevision')), 'null'),
        'original');

ALTER TABLE logo_downloads
    DROP INDEX uq_download_member_candidate,
    ADD CONSTRAINT uq_download_member_candidate_revision UNIQUE (member_id, candidate_id, asset_revision);

-- ⚠ 반드시 여기까지 실행한 뒤, 새 접속에서 아래 한 줄만 따로 실행한다.
--    (같은 접속에서 실행하면 위 UPDATE의 별칭 d가 CHECK에 박혀 다시 깨진다)
ALTER TABLE logo_downloads
    ADD CONSTRAINT chk_download_project_type CHECK (project_type IN ('CI', 'BI'));
