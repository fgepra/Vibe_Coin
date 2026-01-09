import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Users, Wallet } from "lucide-react";
import { MainHeader } from "@/components/main-header";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VibePriceChartServer } from "@/components/vibe-price-chart-server";
import { VibeTradePanel } from "@/components/vibe-trade-panel";
import { PortfolioPanel } from "@/components/portfolio-panel";
import { RankingPanel } from "@/components/ranking-panel";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
                Vibe Coin
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                실시간 모의 투자 사이트
              </p>
            </div>
            <MainHeader email={user?.email ?? null} />
          </div>
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* 코인 차트 영역 */}
          <div className="lg:col-span-2">
            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                  <TrendingUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  Vibe Coin (VIBE)
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-500 mt-1">
                  실시간 가격 변동
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <VibePriceChartServer />
                <VibeTradePanel />
              </CardContent>
            </Card>
          </div>

          {/* 자산 현황 */}
          <div>
            <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Wallet className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  내 자산
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <PortfolioPanel />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 랭킹 영역 */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              전체 유저 랭킹
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-500 mt-1">
              수익률 기준 실시간 순위
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <RankingPanel />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
