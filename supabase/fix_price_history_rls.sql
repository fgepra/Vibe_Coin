-- price_history 테이블 RLS 정책 수정
-- 이 파일을 Supabase SQL Editor에서 실행하세요.

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Price history is viewable by everyone" ON public.price_history;
DROP POLICY IF EXISTS "Price history is insertable by everyone" ON public.price_history;

-- 새로운 정책 생성 (인증된 사용자만 INSERT 가능)
CREATE POLICY "Price history is viewable by everyone"
  ON public.price_history FOR SELECT
  USING (true);

CREATE POLICY "Price history is insertable by authenticated users"
  ON public.price_history FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 또는 모든 사용자가 INSERT 가능하게 하려면 (위 정책 대신):
-- CREATE POLICY "Price history is insertable by everyone"
--   ON public.price_history FOR INSERT
--   WITH CHECK (true);

