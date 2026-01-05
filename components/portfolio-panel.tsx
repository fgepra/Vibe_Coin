"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

type PortfolioData = {
  balance: number;
  vibeQuantity: number;
  vibePrice: number;
};

async function fetchPortfolio(): Promise<PortfolioData> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("로그인 정보가 없습니다.");
  }

  const [{ data: profile }, { data: coin }, { data: holding }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("balance")
        .eq("id", user.id)
        .single(),
      supabase
        .from("coins")
        .select("id, current_price")
        .eq("symbol", "VIBE")
        .single(),
      supabase
        .from("holdings")
        .select("quantity")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const balance = Number(profile?.balance ?? 0);
  const vibeQuantity = Number(holding?.quantity ?? 0);
  const vibePrice = Math.round(Number(coin?.current_price ?? 0));

  return { balance, vibeQuantity, vibePrice };
}

export function PortfolioPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: fetchPortfolio,
  });

  // price_history에 새로운 이력이 추가되면 포트폴리오를 최신 가격 기준으로 재계산
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("portfolio-price-history")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "price_history",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["portfolio"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const initialCapital = 10_000_000;
  const balance = data?.balance ?? initialCapital;
  const vibeQuantity = data?.vibeQuantity ?? 0;
  const vibePrice = data?.vibePrice ?? 0;

  const holdingsValue = vibeQuantity * vibePrice;
  const totalAsset = balance + holdingsValue;
  const profit = totalAsset - initialCapital;
  const profitRate = (profit / initialCapital) * 100;

  const formatKRW = (value: number) =>
    `₩${Math.round(value).toLocaleString()}`;

  const formatPercent = (value: number) =>
    `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

  const loadingText = isLoading ? "불러오는 중..." : undefined;

  return (
    <div className="space-y-4">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-500 mb-1">보유 자산</p>
        <p className="text-2xl font-semibold text-slate-900 dark:text-white">
          {loadingText ?? formatKRW(balance)}
        </p>
      </div>
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-500 mb-1">보유 코인</p>
        <p className="text-2xl font-semibold text-slate-900 dark:text-white">
          {loadingText ?? `${Math.round(vibeQuantity)} VIBE`}
        </p>
      </div>
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-500 mb-1">총 자산</p>
        <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
          {loadingText ?? formatKRW(totalAsset)}
        </p>
      </div>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-500 mb-1">수익률</p>
        <p className={`text-2xl font-semibold ${profitRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {loadingText ?? formatPercent(profitRate)}
        </p>
      </div>
    </div>
  );
}


