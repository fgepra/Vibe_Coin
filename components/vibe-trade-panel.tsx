"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type TradeType = "buy" | "sell";

// 가격 변동 계산 함수 (재사용 가능)
function calculateNewPrice(currentPrice: number): number {
  // 0.1% 확률로 +1,000원 보너스
  const random = Math.random();
  if (random < 0.001) {
    // 0.1% 확률
    const bonusPrice = currentPrice + 1000;
    return Math.max(100, Math.round(bonusPrice)); // 최소 100원 보장
  }

  // 일반적인 가격 변동: 현재 가격의 ±5% 범위 내에서 랜덤하게 변동
  const priceChangePercent = (Math.random() - 0.5) * 10; // -5% ~ +5%
  const priceChange = currentPrice * (priceChangePercent / 100);
  let newPrice = Math.max(100, currentPrice + priceChange); // 최소 100원 보장
  newPrice = Math.round(newPrice); // 정수로 반올림 (소수점 제거)
  return newPrice;
}

// 코인 가격 업데이트 함수 (재사용 가능)
async function updateCoinPrice(newPrice: number, coinId: string) {
  const supabase = createClient();
  
  // 정수로 변환
  const roundedPrice = Math.round(newPrice);
  
  // 병렬로 coins 업데이트와 price_history 삽입 실행
  const [updateCoinResult, priceHistoryResult] = await Promise.all([
    supabase
      .from("coins")
      .update({ current_price: roundedPrice })
      .eq("id", coinId),
    supabase
      .from("price_history")
      .insert({
        price: roundedPrice,
      }),
  ]);

  if (updateCoinResult.error) {
    console.error("❌ 코인 가격 업데이트 중 오류:", updateCoinResult.error);
    return false;
  }

  if (priceHistoryResult.error) {
    console.error("❌ 가격 이력 저장 중 오류:", priceHistoryResult.error);
    return false;
  }

  return true;
}

async function executeTrade(type: TradeType, quantity: number) {
  const supabase = createClient();

  // 1. 사용자 정보 조회
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("로그인 정보가 없습니다. 다시 로그인해주세요.");
  }

  // 2. 병렬로 초기 데이터 조회 (코인, 프로필, 보유 코인)
  const [coinResult, profileResult] = await Promise.all([
    supabase
      .from("coins")
      .select("id, current_price")
      .eq("symbol", "VIBE")
      .single(),
    supabase
      .from("profiles")
      .select("id, balance")
      .eq("id", user.id)
      .single(),
  ]);

  const { data: coin, error: coinError } = coinResult;
  const { data: profile, error: profileError } = profileResult;

  if (coinError || !coin) {
    throw new Error("VIBE 코인 정보를 불러오지 못했습니다.");
  }

  if (profileError || !profile) {
    throw new Error("프로필 정보를 불러오지 못했습니다.");
  }

  const price = Math.round(Number(coin.current_price));
  if (!Number.isFinite(price)) {
    throw new Error("유효하지 않은 코인 가격입니다.");
  }

  const totalAmount = price * quantity;

  // 3. 보유 코인 조회
  const { data: holding, error: holdingError } = await supabase
    .from("holdings")
    .select("id, quantity, average_price")
    .eq("user_id", user.id)
    .eq("coin_id", coin.id)
    .maybeSingle();

  if (holdingError) {
    throw new Error("보유 코인 정보를 불러오지 못했습니다.");
  }

  if (type === "buy") {
    if (Number(profile.balance) < totalAmount) {
      throw new Error("잔액이 부족합니다.");
    }

    const prevQty = Number(holding?.quantity ?? 0);
    const prevAvg = Number(holding?.average_price ?? 0);
    const newQty = prevQty + quantity;
    const newAvg =
      newQty > 0
        ? (prevQty * prevAvg + quantity * price) / newQty
        : price;

    // 병렬로 업데이트 작업 실행 (holdings, profiles, transactions)
    const [upsertHoldingResult, updateProfileResult, insertTxResult] = await Promise.all([
      supabase
        .from("holdings")
        .upsert(
          {
            id: holding?.id,
            user_id: user.id,
            coin_id: coin.id,
            quantity: newQty,
            average_price: newAvg,
          },
          { onConflict: "id" }
        ),
      supabase
        .from("profiles")
        .update({
          balance: Number(profile.balance) - totalAmount,
        })
        .eq("id", user.id),
      supabase.from("transactions").insert({
        user_id: user.id,
        coin_id: coin.id,
        type: "buy",
        quantity,
        price,
        total_amount: totalAmount,
      }),
    ]);

    if (upsertHoldingResult.error) {
      throw new Error("보유 코인 업데이트 중 오류가 발생했습니다.");
    }

    if (updateProfileResult.error) {
      throw new Error("잔액 업데이트 중 오류가 발생했습니다.");
    }

    if (insertTxResult.error) {
      throw new Error("거래 내역 저장 중 오류가 발생했습니다.");
    }
  } else {
    // sell
    const prevQty = Number(holding?.quantity ?? 0);
    if (prevQty < quantity) {
      throw new Error("보유 코인이 부족합니다.");
    }

    const newQty = prevQty - quantity;

    // 병렬로 업데이트 작업 실행 (holdings, profiles, transactions)
    const [upsertHoldingResult, updateProfileResult, insertTxResult] = await Promise.all([
      supabase
        .from("holdings")
        .upsert(
          {
            id: holding?.id,
            user_id: user.id,
            coin_id: coin.id,
            quantity: newQty,
            average_price: holding?.average_price ?? price,
          },
          { onConflict: "id" }
        ),
      supabase
        .from("profiles")
        .update({
          balance: Number(profile.balance) + totalAmount,
        })
        .eq("id", user.id),
      supabase.from("transactions").insert({
        user_id: user.id,
        coin_id: coin.id,
        type: "sell",
        quantity,
        price,
        total_amount: totalAmount,
      }),
    ]);

    if (upsertHoldingResult.error) {
      throw new Error("보유 코인 업데이트 중 오류가 발생했습니다.");
    }

    if (updateProfileResult.error) {
      throw new Error("잔액 업데이트 중 오류가 발생했습니다.");
    }

    if (insertTxResult.error) {
      throw new Error("거래 내역 저장 중 오류가 발생했습니다.");
    }
  }

  // 거래 후 가격 변동 로직 (랜덤 변동)
  const finalPrice = calculateNewPrice(price);

  console.log("💰 거래 후 가격 변동:", {
    이전_가격: price,
    새_가격: finalPrice,
    변동액: (finalPrice - price).toFixed(2),
  });

  // 가격 업데이트
  await updateCoinPrice(finalPrice, coin.id);

  return finalPrice;
}

export function VibeTradePanel() {
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState<number>(1);
  const [price, setPrice] = useState<number | null>(null);

  // 보유 코인 수량 가져오기
  const fetchHoldings = async (): Promise<number> => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return 0;
    }

    // 코인 정보 가져오기
    const { data: coin } = await supabase
      .from("coins")
      .select("id")
      .eq("symbol", "VIBE")
      .single();

    if (!coin) {
      return 0;
    }

    // 보유 코인 수량 가져오기
    const { data: holding } = await supabase
      .from("holdings")
      .select("quantity")
      .eq("user_id", user.id)
      .eq("coin_id", coin.id)
      .maybeSingle();

    return Math.round(Number(holding?.quantity ?? 0));
  };

  // 전량 버튼 클릭 핸들러
  const handleMaxQuantity = async () => {
    const maxQuantity = await fetchHoldings();
    if (maxQuantity > 0) {
      setQuantity(maxQuantity);
    } else {
      toast.error("보유한 코인이 없습니다.");
    }
  };

  const fetchPrice = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("coins")
      .select("current_price")
      .eq("symbol", "VIBE")
      .single();

    if (!error && data) {
      setPrice(Math.round(Number(data.current_price)));
    }
  };

  useEffect(() => {
    // 현재 가격을 한 번 가져와서 표시
    fetchPrice();

    // coins 테이블의 current_price가 업데이트될 때마다 실시간으로 가격 갱신
    const supabase = createClient();
    const channel = supabase
      .channel("trade-panel-coin-price")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "coins",
          filter: "symbol=eq.VIBE",
        },
        (payload) => {
          const newPrice = Number(
            (payload.new as { current_price?: number }).current_price ?? NaN
          );
          if (Number.isFinite(newPrice)) {
            console.log("💰 거래 패널 가격 업데이트:", newPrice);
            setPrice(Math.round(newPrice));
          }
        }
      )
      .subscribe();

    // 주기적으로 코인 가격 자동 변동 (5초마다)
    const autoUpdatePrice = async () => {
      const supabase = createClient();
      const { data: coinData, error: coinError } = await supabase
        .from("coins")
        .select("id, current_price")
        .eq("symbol", "VIBE")
        .single();

      if (!coinError && coinData) {
        const currentPrice = Math.round(Number(coinData.current_price));
        const newPrice = calculateNewPrice(currentPrice);

        console.log("📈 자동 가격 변동:", {
          이전_가격: currentPrice,
          새_가격: newPrice,
          변동액: (newPrice - currentPrice).toFixed(2),
        });

        await updateCoinPrice(newPrice, coinData.id);
      }
    };

    // 5초마다 가격 변동
    const intervalId = setInterval(autoUpdatePrice, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, []);

  const { mutate: trade, isPending } = useMutation({
    mutationFn: async (type: TradeType) => {
      if (quantity <= 0) {
        throw new Error("수량은 0보다 커야 합니다.");
      }
      if (!Number.isInteger(quantity)) {
        throw new Error("수량은 정수만 입력 가능합니다.");
      }
      const finalPrice = await executeTrade(type, quantity);
      return { type, finalPrice };
    },
    onSuccess: (result) => {
      if (!result) return;
      const { type, finalPrice } = result;
      toast.success(type === "buy" ? "매수가 완료되었습니다." : "매도가 완료되었습니다.");

      // 최신 가격으로 표시 갱신
      setPrice(finalPrice);

      // 자산 패널/보유량 갱신
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onError: (error: Error | unknown) => {
      const errorMessage = error instanceof Error ? error.message : "거래 중 오류가 발생했습니다.";
      toast.error(errorMessage);
    },
  });

  const formattedPrice =
    price != null ? `₩${Math.round(price).toLocaleString()}` : "가격 불러오는 중...";

  return (
    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex-1">
          <p className="text-sm text-slate-500 dark:text-slate-500 mb-1">
            현재가
          </p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
            {formattedPrice}
          </p>
          <div className="space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-500">
              수량 (VIBE)
            </p>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min={1}
                step={1}
                value={Number.isNaN(quantity) ? "" : quantity}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setQuantity(1);
                    return;
                  }
                  const num = Number(value);
                  if (Number.isInteger(num) && num > 0) {
                    setQuantity(num);
                  }
                }}
                className="w-32"
              />
              <Button
                variant="outline"
                type="button"
                size="sm"
                onClick={handleMaxQuantity}
                disabled={isPending}
              >
                전량
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
          <Button
            variant="outline"
            className="flex-1 lg:flex-none"
            type="button"
            disabled={isPending}
            onClick={() => trade("sell")}
          >
            매도
          </Button>
          <Button
            className="flex-1 lg:flex-none bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
            type="button"
            disabled={isPending}
            onClick={() => trade("buy")}
          >
            매수
          </Button>
        </div>
      </div>
    </div>
  );
}


