# Vibe Coin - 실시간 모의 투자 게임

Next.js, TypeScript, Tailwind CSS, Supabase를 사용한 실시간 모의 투자 게임 MVP입니다.

## 기술 스택

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **UI Components**: Shadcn UI, Lucide-react (아이콘)
- **State Management**: TanStack Query (React Query)
- **Backend/Database**: Supabase (Auth, Database, Realtime)

## 주요 기능

- ✅ Google/Email 로그인 (Supabase Auth)
- ✅ 초기 자산 1,000만원 지급
- ✅ 실시간 가상 코인 차트 (랜덤 변동)
- ✅ 매수/매도 기능
- ✅ 실시간 자산 현황
- ✅ 전체 유저 수익률 랭킹

## 프로젝트 구조

```
pj/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # 루트 레이아웃
│   ├── page.tsx           # 메인 페이지
│   ├── providers.tsx      # React Query Provider
│   └── globals.css        # 전역 스타일
├── components/            # React 컴포넌트
│   └── ui/               # Shadcn UI 컴포넌트
├── lib/                  # 유틸리티 및 설정
│   ├── supabase/         # Supabase 클라이언트
│   └── utils.ts          # 유틸리티 함수
├── types/                # TypeScript 타입 정의
│   └── database.types.ts # Supabase 데이터베이스 타입
├── supabase/             # Supabase 설정
│   └── schema.sql        # 데이터베이스 스키마
└── middleware.ts         # Next.js 미들웨어
```

## 데이터베이스 구조

### 테이블

1. **profiles**: 유저 정보 및 잔액
   - `id`: UUID (auth.users 참조)
   - `email`: 이메일
   - `balance`: 잔액 (기본값: 10,000,000원)
   - `total_profit`: 총 수익

2. **coins**: 가상 코인 정보
   - `id`: UUID
   - `symbol`: 코인 심볼 (예: VIBE)
   - `name`: 코인 이름
   - `current_price`: 현재가
   - `price_change_24h`: 24시간 변동액
   - `price_change_percent_24h`: 24시간 변동률

3. **holdings**: 보유 종목
   - `user_id`: 유저 ID
   - `coin_id`: 코인 ID
   - `quantity`: 보유 수량
   - `average_price`: 평균 매수가

4. **transactions**: 거래 이력
   - `user_id`: 유저 ID
   - `coin_id`: 코인 ID
   - `type`: 거래 유형 (buy/sell)
   - `quantity`: 거래 수량
   - `price`: 거래 가격
   - `total_amount`: 총 거래 금액

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 프로젝트 설정에서 URL과 Anon Key 복사
3. `.env.local` 파일 생성:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 데이터베이스 스키마 적용

1. Supabase 대시보드에서 SQL Editor 열기
2. `supabase/schema.sql` 파일의 내용을 복사하여 실행

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 열기

## 다음 단계

- [ ] 인증 기능 구현 (Google/Email 로그인)
- [ ] 실시간 코인 가격 변동 로직 구현
- [ ] 매수/매도 기능 구현
- [ ] 실시간 차트 UI 구현
- [ ] 랭킹 시스템 구현
- [ ] 보유 종목 관리 기능

## 라이선스

MIT
