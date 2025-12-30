-- price_history 테이블 생성
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  price DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Price history is viewable by everyone" ON public.price_history;
DROP POLICY IF EXISTS "Price history is insertable by everyone" ON public.price_history;

-- price_history policies (모든 사용자가 읽고 쓸 수 있음)
CREATE POLICY "Price history is viewable by everyone"
  ON public.price_history FOR SELECT
  USING (true);

CREATE POLICY "Price history is insertable by everyone"
  ON public.price_history FOR INSERT
  WITH CHECK (true);

-- Realtime 활성화 (price_history 테이블)
ALTER PUBLICATION supabase_realtime ADD TABLE price_history;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_price_history_created_at ON public.price_history(created_at DESC);

