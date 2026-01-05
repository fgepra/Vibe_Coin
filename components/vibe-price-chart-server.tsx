import { createClient } from "@/lib/supabase/server";
import { VibePriceChart } from "./vibe-price-chart";

export async function VibePriceChartServer() {
  const supabase = await createClient();

  // price_history에서 created_at 기준 내림차순으로 최근 50개 조회
  const { data: history, error } = await supabase
    .from("price_history")
    .select("price, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("❌ 가격 이력 조회 실패:", error);
  } else {
    console.log("✅ 가격 이력 조회 성공:", {
      개수: Array.isArray(history) ? history.length : 0,
      첫_데이터: Array.isArray(history) && history.length > 0 ? history[0] : null,
    });
  }

  const safeHistory = Array.isArray(history) ? history : [];

  // 차트는 오래된 시간부터 보이도록 다시 오름차순 정렬
  const sorted = [...safeHistory].sort(
    (a, b) =>
      new Date(a.created_at as string).getTime() -
      new Date(b.created_at as string).getTime()
  );

  // 5초 버킷 단위로 정규화
  const BUCKET_MS = 5000;
  const snapToBucket = (timestamp: number): number => {
    return Math.floor(timestamp / BUCKET_MS) * BUCKET_MS;
  };

  const bucketMap = new Map<number, { price: number; createdAt: string; timestamp: number }>();

  // 모든 포인트를 5초 버킷으로 그룹화 (같은 버킷에서는 가장 최신 값 사용)
  for (const item of sorted) {
    const createdAt = item.created_at as string;
    const date = new Date(createdAt);
    const rawTs = date.getTime();
    const bucketTs = snapToBucket(rawTs);

    const existing = bucketMap.get(bucketTs);
    if (!existing || rawTs > existing.timestamp) {
      bucketMap.set(bucketTs, {
        price: Math.round(Number(item.price)),
        createdAt,
        timestamp: rawTs,
      });
    }
  }

  // 버킷을 타임스탬프 순으로 정렬하여 배열로 변환 (유효한 데이터만)
  const initialData = Array.from(bucketMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucketTs, item]) => {
      const date = new Date(bucketTs);
      const price = Number(item.price);
      return {
        time: date.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        timestamp: bucketTs,
        price: isFinite(price) ? price : 0,
        createdAt: item.createdAt,
      };
    })
    .filter((item) => item.price > 0 && !isNaN(item.timestamp)); // 유효한 데이터만 필터링

  console.log("📊 초기 차트 데이터:", {
    개수: initialData.length,
    첫_포인트: initialData[0] ?? null,
    마지막_포인트: initialData[initialData.length - 1] ?? null,
  });

  return <VibePriceChart initialData={initialData} />;
}




