-- ============================================
-- Vibe Coin 실시간 모의 투자 게임 - 완전한 데이터베이스 스키마
-- ============================================
-- 이 파일을 Supabase SQL Editor에서 실행하세요.
-- 모든 테이블, 정책, 트리거, Realtime 설정이 포함되어 있습니다.

-- 1. UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. Profiles 테이블 (유저 프로필 및 잔액)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  balance DECIMAL(15, 2) DEFAULT 10000000.00, -- 초기 자산 1,000만원
  total_profit DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Profiles RLS 정책
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- ============================================
-- 3. Coins 테이블 (가상 코인 정보)
-- ============================================
CREATE TABLE IF NOT EXISTS public.coins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  current_price DECIMAL(15, 2) NOT NULL,
  price_change_24h DECIMAL(15, 2) DEFAULT 0.00,
  price_change_percent_24h DECIMAL(10, 4) DEFAULT 0.0000,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.coins ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Coins are viewable by everyone" ON public.coins;
DROP POLICY IF EXISTS "Coins are updatable by authenticated users" ON public.coins;

-- Coins RLS 정책
CREATE POLICY "Coins are viewable by everyone"
  ON public.coins FOR SELECT
  USING (true);

-- 인증된 사용자가 coins.current_price를 업데이트할 수 있도록 (거래 시 가격 업데이트용)
CREATE POLICY "Coins are updatable by authenticated users"
  ON public.coins FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 4. Holdings 테이블 (보유 종목)
-- ============================================
CREATE TABLE IF NOT EXISTS public.holdings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  coin_id UUID REFERENCES public.coins(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(15, 8) NOT NULL DEFAULT 0,
  average_price DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, coin_id)
);

-- Enable Row Level Security
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Users can view own holdings" ON public.holdings;
DROP POLICY IF EXISTS "Users can insert own holdings" ON public.holdings;
DROP POLICY IF EXISTS "Users can update own holdings" ON public.holdings;

-- Holdings RLS 정책
CREATE POLICY "Users can view own holdings"
  ON public.holdings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own holdings"
  ON public.holdings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own holdings"
  ON public.holdings FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 5. Transactions 테이블 (거래 이력)
-- ============================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  coin_id UUID REFERENCES public.coins(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  quantity DECIMAL(15, 8) NOT NULL,
  price DECIMAL(15, 2) NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;

-- Transactions RLS 정책
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 6. Price History 테이블 (가격 이력)
-- ============================================
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
DROP POLICY IF EXISTS "Price history is insertable by authenticated users" ON public.price_history;

-- Price History RLS 정책
CREATE POLICY "Price history is viewable by everyone"
  ON public.price_history FOR SELECT
  USING (true);

CREATE POLICY "Price history is insertable by authenticated users"
  ON public.price_history FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_price_history_created_at ON public.price_history(created_at DESC);

-- ============================================
-- 7. Realtime 활성화
-- ============================================
-- coins 테이블의 UPDATE 이벤트를 Realtime으로 구독
ALTER PUBLICATION supabase_realtime ADD TABLE coins;

-- price_history 테이블의 INSERT 이벤트를 Realtime으로 구독
ALTER PUBLICATION supabase_realtime ADD TABLE price_history;

-- ============================================
-- 8. Functions (함수)
-- ============================================

-- 회원가입 시 프로필 자동 생성 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. Triggers (트리거)
-- ============================================

-- 회원가입 시 프로필 자동 생성 트리거
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_holdings_updated_at ON public.holdings;
CREATE TRIGGER update_holdings_updated_at
  BEFORE UPDATE ON public.holdings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_coins_updated_at ON public.coins;
CREATE TRIGGER update_coins_updated_at
  BEFORE UPDATE ON public.coins
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 10. 초기 데이터 삽입
-- ============================================

-- VIBE 코인 초기 데이터
INSERT INTO public.coins (symbol, name, current_price)
VALUES ('VIBE', 'Vibe Coin', 1000.00)
ON CONFLICT (symbol) DO UPDATE SET current_price = 1000.00;

-- price_history 초기 데이터 (최근 6분간의 데이터)
INSERT INTO public.price_history (price, created_at)
VALUES 
  (1000.00, NOW() - INTERVAL '5 minutes'),
  (1000.00, NOW() - INTERVAL '4 minutes'),
  (1000.00, NOW() - INTERVAL '3 minutes'),
  (1000.00, NOW() - INTERVAL '2 minutes'),
  (1000.00, NOW() - INTERVAL '1 minute'),
  (1000.00, NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- 완료!
-- ============================================
-- 모든 테이블, 정책, 트리거, Realtime 설정이 완료되었습니다.
-- 이제 애플리케이션을 사용할 수 있습니다.

