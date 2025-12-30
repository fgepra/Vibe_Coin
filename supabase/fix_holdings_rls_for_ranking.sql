-- Holdings 테이블의 RLS 정책을 수정하여 랭킹 기능을 위해 모든 사용자가 holdings를 볼 수 있도록 함
-- (수량만 볼 수 있고, 수정은 불가능)

-- 기존 정책은 유지하고, 모든 사용자가 holdings를 볼 수 있는 정책 추가
CREATE POLICY "Holdings are viewable by everyone for ranking"
  ON public.holdings FOR SELECT
  USING (true);

