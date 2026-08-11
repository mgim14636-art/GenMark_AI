-- V22: brand_kits.kit_type 값을 BOTTLE -> THUMBNAIL 로 변경
--
-- 배경
-- - BI 브랜드킷의 생성물을 "로션 병"에서 "제품 썸네일"로 변경하기로 했다.
-- - 프론트엔드는 이미 "제품 썸네일"이라는 이름을 쓰고 있었고(App.tsx의 '제품 썸네일 만들기'
--   버튼, 설문 옵션 등) 백엔드/DB만 BOTTLE로 남아 있어 용어가 어긋난 상태였다.
--
-- 무엇을 바꾸나
-- - kit_type에 걸린 CHECK 제약을 ('BUSINESS_CARD','BOTTLE') 에서
--   ('BUSINESS_CARD','THUMBNAIL') 로 교체한다.
-- - 이미 저장된 BOTTLE 행이 있으면 THUMBNAIL로 바꾼다.
--   (작성 시점 brand_kits는 0건이라 실제로 바뀔 행은 없다.)
--
-- 왜 CHECK 제약을 반드시 같이 바꿔야 하나
-- - 자바 코드만 THUMBNAIL로 바꾸고 DB를 그대로 두면, 브랜드킷을 만들 때마다
--   CHECK 제약에 걸려 INSERT가 거부된다. 그래서 DB를 먼저(또는 최소한 같이) 바꿔야 한다.
--
-- ★ MariaDB 10.5.10 주의
--
-- 운영 DB는 MariaDB 10.5.10이다. V20에서 겪었듯 이 버전은 CHECK 제약이 걸린 테이블의
-- ALTER가 거부되는 경우가 있다. 다만 그때는 제약의 "저장된 정의"가 손상된 상태였고,
-- brand_kits의 chk_kit_type은 정의가 정상임을 확인했다.
--
--   확인 결과: chk_kit_type => `kit_type` in ('BUSINESS_CARD','BOTTLE')   (정상)
--
-- 그래도 혹시 ALTER가 실패하면, brand_kits는 0건이므로 아래 "대안" 주석의 방법으로
-- 테이블을 다시 만들면 된다.
--
-- 여러 번 실행해도 안전하다 (이미 바뀌어 있으면 건너뛴다).

SET @db := DATABASE();

-- 1) 남아 있는 BOTTLE 데이터를 먼저 THUMBNAIL로 바꾼다.
--    CHECK 제약을 새로 걸기 전에 값을 정리해야 제약 추가가 거부되지 않는다.
UPDATE `brand_kits` SET `kit_type` = 'THUMBNAIL' WHERE `kit_type` = 'BOTTLE';

-- 2) 기존 CHECK 제약 제거 (남아 있을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'brand_kits'
        AND CONSTRAINT_NAME = 'chk_kit_type') = 1,
    'ALTER TABLE `brand_kits` DROP CONSTRAINT `chk_kit_type`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) THUMBNAIL을 허용하는 CHECK 제약으로 다시 건다 (없을 때만)
SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'brand_kits'
        AND CONSTRAINT_NAME = 'chk_kit_type') = 0,
    'ALTER TABLE `brand_kits` ADD CONSTRAINT `chk_kit_type` CHECK (`kit_type` IN (''BUSINESS_CARD'', ''THUMBNAIL''))',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ★ 대안 — 위 ALTER가 MariaDB 10.5.10 결함으로 실패하는 경우에만 사용한다.
--   brand_kits에 행이 하나라도 있으면 데이터가 사라지므로 절대 그냥 쓰지 말 것.
--
--   SET FOREIGN_KEY_CHECKS = 0;
--   DROP TABLE `brand_kits`;
--   -- 그 다음 V17__create_brand_kits.sql의 CREATE TABLE 문을 복사하되
--   -- chk_kit_type의 'BOTTLE'만 'THUMBNAIL'로 바꿔서 실행한다.
--   SET FOREIGN_KEY_CHECKS = 1;
