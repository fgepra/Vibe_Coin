"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

type RankingData = {
  email: string;
  totalAsset: number;
  profitRate: number;
};

async function fetchRankings(): Promise<RankingData[]> {
  const supabase = createClient();

  // 모든 프로필, VIBE 코인 가격, 모든 holdings를 한 번에 가져오기
  const [{ data: profiles }, { data: coin }, { data: allHoldings }] = await Promise.all([
    supabase.from("profiles").select("id, email, balance").order("created_at", { ascending: true }),
    supabase.from("coins").select("id, current_price").eq("symbol", "VIBE").single(),
    supabase.from("holdings").select("user_id, quantity, coin_id"),
  ]);

  if (!profiles || !coin) {
    return [];
  }

  const vibePrice = Number(coin.current_price ?? 0);
  const initialCapital = 10_000_000;

  // holdings를 user_id별로 매핑 (성능 최적화)
  const holdingsMap = new Map<string, number>();
  (allHoldings ?? []).forEach((holding) => {
    if (holding.coin_id === coin.id) {
      holdingsMap.set(holding.user_id, Number(holding.quantity ?? 0));
    }
  });

  // 각 유저의 랭킹 데이터 계산
  const rankings: RankingData[] = profiles.map((profile) => {
    const balance = Number(profile.balance ?? 0);
    const quantity = holdingsMap.get(profile.id) ?? 0;
    const holdingsValue = quantity * vibePrice;
    const totalAsset = balance + holdingsValue;
    const profitRate = ((totalAsset - initialCapital) / initialCapital) * 100;

    return {
      email: profile.email ?? "알 수 없음",
      totalAsset,
      profitRate,
    };
  });

  // 수익률 기준으로 내림차순 정렬하고 상위 5명만 반환
  return rankings.sort((a, b) => b.profitRate - a.profitRate).slice(0, 5);
}

export function RankingPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["rankings"],
    queryFn: fetchRankings,
    refetchInterval: 5000, // 5초마다 자동 갱신
  });

  // price_history나 profiles가 업데이트되면 랭킹 갱신
  useEffect(() => {
    const supabase = createClient();

    const channel1 = supabase
      .channel("ranking-price-history")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "price_history",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["rankings"] });
        }
      )
      .subscribe();

    const channel2 = supabase
      .channel("ranking-profiles")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["rankings"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
  }, [queryClient]);

  const formatKRW = (value: number) => `₩${Math.round(value).toLocaleString()}`;
  const formatPercent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return "bg-amber-500 text-white";
    if (rank === 2) return "bg-slate-400 text-white";
    if (rank === 3) return "bg-amber-700 text-white";
    return "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300";
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((rank) => (
          <div
            key={rank}
            className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${getRankBadgeColor(rank)}`}>
                {rank}
              </div>
              <p className="text-slate-500 dark:text-slate-500">불러오는 중...</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-500 border border-slate-200 dark:border-slate-800 rounded-lg">
        랭킹 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((user, index) => {
        const rank = index + 1;
        const isProfit = user.profitRate >= 0;
        return (
          <div
            key={user.email + rank}
            className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${getRankBadgeColor(rank)}`}>
                {rank}
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  {user.email}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  총 자산: {formatKRW(user.totalAsset)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p
                className={`text-lg font-semibold ${
                  isProfit
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatPercent(user.profitRate)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

