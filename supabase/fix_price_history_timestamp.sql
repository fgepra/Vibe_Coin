-- ============================================
-- price_history 테이블 시간대 정렬 보장 SQL
-- ============================================
-- 이 파일을 Supabase SQL Editor에서 실행하세요.

-- 1. created_at 컬럼이 항상 현재 시간으로 설정되도록 트리거 생성
-- ============================================

-- 기존 트리거가 있다면 삭제
DROP TRIGGER IF EXISTS ensure_price_history_created_at ON public.price_history;

-- created_at을 항상 현재 시간으로 설정하는 함수
CREATE OR REPLACE FUNCTION public.ensure_price_history_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- created_at이 NULL이거나 과거 시간이면 현재 시간으로 설정
  IF NEW.created_at IS NULL OR NEW.created_at < NOW() THEN
    NEW.created_at = TIMEZONE('utc'::text, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (INSERT 전에 실행)
CREATE TRIGGER ensure_price_history_created_at
  BEFORE INSERT ON public.price_history
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_price_history_timestamp();

-- 2. 인덱스 확인 및 재생성 (created_at 기준 정렬 최적화)
-- ============================================

-- 기존 인덱스 삭제 (있다면)
DROP INDEX IF EXISTS idx_price_history_created_at;

-- created_at 기준 내림차순 인덱스 생성 (최신 데이터 조회 최적화)
CREATE INDEX idx_price_history_created_at_desc 
  ON public.price_history(created_at DESC);

-- created_at 기준 오름차순 인덱스도 생성 (차트 표시용)
CREATE INDEX idx_price_history_created_at_asc 
  ON public.price_history(created_at ASC);

-- 3. 기존 데이터의 created_at이 NULL인 경우 현재 시간으로 업데이트
-- ============================================

UPDATE public.price_history
SET created_at = TIMEZONE('utc'::text, NOW())
WHERE created_at IS NULL;

-- 4. 테이블 구조 확인 쿼리 (실행 후 확인용)
-- ============================================
-- SELECT 
--   column_name, 
--   data_type, 
--   is_nullable,
--   column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'price_history'
-- ORDER BY ordinal_position;

-- 5. 최근 데이터 확인 쿼리 (실행 후 확인용)
-- ============================================
-- SELECT 
--   id,
--   price,
--   created_at,
--   EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_ago
-- FROM public.price_history
-- ORDER BY created_at DESC
-- LIMIT 10;

-- ============================================
-- 완료!
-- ============================================
-- 이제 price_history 테이블에 INSERT할 때마다 created_at이 자동으로 현재 시간으로 설정됩니다.
-- 데이터는 created_at 기준으로 정렬되어 저장됩니다.

