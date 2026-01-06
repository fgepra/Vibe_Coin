import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// 가격 변동 계산 함수
function calculateNewPrice(currentPrice: number): number {
  // 0.1% 확률로 +1,000원 보너스
  const random = Math.random();
  if (random < 0.001) {
    const bonusPrice = currentPrice + 1000;
    return Math.max(100, Math.round(bonusPrice));
  }

  // 일반적인 가격 변동: 현재 가격의 ±5% 범위 내에서 랜덤하게 변동
  const priceChangePercent = (Math.random() - 0.5) * 10; // -5% ~ +5%
  const priceChange = currentPrice * (priceChangePercent / 100);
  let newPrice = Math.max(100, currentPrice + priceChange);
  newPrice = Math.round(newPrice);
  return newPrice;
}

export async function GET() {
  try {
    // Cron Job은 인증이 없으므로 Service Role Key 사용 (RLS 우회)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase 환경 변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // VIBE 코인 정보 조회
    const { data: coinData, error: coinError } = await supabase
      .from("coins")
      .select("id, current_price")
      .eq("symbol", "VIBE")
      .single();

    if (coinError || !coinData) {
      return NextResponse.json(
        { error: "코인 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const currentPrice = Math.round(Number(coinData.current_price));
    const newPrice = calculateNewPrice(currentPrice);
    const roundedPrice = Math.round(newPrice);

    // 병렬로 coins 업데이트와 price_history 삽입
    const [updateCoinResult, priceHistoryResult] = await Promise.all([
      supabase
        .from("coins")
        .update({ current_price: roundedPrice })
        .eq("id", coinData.id),
      supabase
        .from("price_history")
        .insert({
          price: roundedPrice,
          created_at: new Date().toISOString(),
        }),
    ]);

    if (updateCoinResult.error) {
      return NextResponse.json(
        { error: "코인 가격 업데이트 실패", details: updateCoinResult.error },
        { status: 500 }
      );
    }

    if (priceHistoryResult.error) {
      return NextResponse.json(
        { error: "가격 이력 저장 실패", details: priceHistoryResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      previousPrice: currentPrice,
      newPrice: roundedPrice,
      change: roundedPrice - currentPrice,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "서버 오류", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

