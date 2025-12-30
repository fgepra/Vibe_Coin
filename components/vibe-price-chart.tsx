"use client";

import { useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

type PricePoint = {
  time: string;
  timestamp: number; // 타임스탬프 (밀리초) - X축 정확한 매칭을 위해
  price: number;
  createdAt?: string; // 원본 시간 (초 단위 포함) 
};

type Props = {
  initialData: PricePoint[];
};

const MAX_POINTS = 100;
const BUCKET_MS = 5000; // 5초 단위 버킷

// 타임스탬프를 5초 단위 버킷으로 정규화
function snapToBucket(timestamp: number): number {
  return Math.floor(timestamp / BUCKET_MS) * BUCKET_MS;
}

// 데이터 배열을 5초 버킷 기준으로 정규화하는 함수
function normalizeData(points: PricePoint[]): PricePoint[] {
  if (!points || points.length === 0) {
    return [];
  }

  // 타임스탬프 기준으로 정렬
  const sorted = [...points].sort((a, b) => {
    const tsA = a.timestamp ?? (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const tsB = b.timestamp ?? (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return tsA - tsB;
  });

  const bucketMap = new Map<number, PricePoint>();

  // 모든 포인트를 5초 버킷으로 그룹화
  for (const point of sorted) {
    const rawTs = point.timestamp ?? (point.createdAt ? new Date(point.createdAt).getTime() : Date.now());
    const bucketTs = snapToBucket(rawTs);

    // 같은 버킷이면 가장 최신 값으로 유지 (나중에 온 값이 우선)
    const existing = bucketMap.get(bucketTs);
    if (!existing || rawTs > (existing.timestamp ?? (existing.createdAt ? new Date(existing.createdAt).getTime() : 0))) {
      const timeLabel = new Date(bucketTs).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      bucketMap.set(bucketTs, {
        ...point,
        timestamp: bucketTs,
        time: timeLabel,
      });
    }
  }

  // 버킷을 타임스탬프 순으로 정렬하여 배열로 변환
  return Array.from(bucketMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([_, point]) => point);
}

export function VibePriceChart({ initialData }: Props) {
  const [data, setData] = useState<PricePoint[]>(initialData ?? []);

  useEffect(() => {
    // 초기 데이터가 바뀌면 5초 버킷 기준으로 정규화해서 동기화
    if (!initialData || initialData.length === 0) {
      setData([]);
      return;
    }

    // normalizeData 함수를 사용하여 정규화
    const normalized = normalizeData(initialData);
    setData(normalized);
  }, [initialData]);

  useEffect(() => {
    const supabase = createClient();

    // price_history 테이블에 INSERT 발생 시 실시간으로 데이터 추가
    const channel1 = supabase
      .channel("vibe-price-history")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "price_history",
        },
        (payload) => {
          console.log("📊 [price_history INSERT] Realtime 이벤트 수신:", payload);
          const row = payload.new as { price?: number; created_at?: string };
          const price = Number(row.price ?? NaN);
          const createdAt = row.created_at;

          console.log("📊 파싱된 데이터:", { price, createdAt });

          if (!Number.isFinite(price) || !createdAt) {
            console.warn("⚠️ 유효하지 않은 데이터:", { price, createdAt });
            return;
          }

          setData((prev) => {
            const date = new Date(createdAt);
            const rawTs = date.getTime();
            const bucketTs = snapToBucket(rawTs);
            const timeLabel = new Date(bucketTs).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            const newPoint: PricePoint = {
              time: timeLabel,
              timestamp: bucketTs,
              price,
              createdAt: createdAt, // 원본 시간 저장
            };

            // 새 포인트를 추가하고 전체 데이터를 다시 정규화
            const withNewPoint = [...prev, newPoint];
            const normalized = normalizeData(withNewPoint);

            console.log("📊 차트 데이터 업데이트:", {
              이전_개수: prev.length,
              새_포인트: newPoint,
              정규화_후_개수: normalized.length,
            });

            // 오래된 데이터 제거 (성능 최적화)
            if (normalized.length > MAX_POINTS) {
              return normalized.slice(normalized.length - MAX_POINTS);
            }

            return normalized;
          });
        }
      )
      .subscribe();

    // coins 테이블의 current_price UPDATE도 구독 (price_history INSERT 실패 시 대비)
    const channel2 = supabase
      .channel("vibe-coin-price-update")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "coins",
          filter: "symbol=eq.VIBE",
        },
        (payload) => {
          console.log("📊 [coins UPDATE] Realtime 이벤트 수신:", payload);
          const newPrice = Number(
            (payload.new as { current_price?: number }).current_price ?? NaN
          );
          if (!Number.isFinite(newPrice)) {
            console.warn("⚠️ 유효하지 않은 가격:", newPrice);
            return;
          }

          // price_history INSERT가 실패했을 때를 대비해 coins UPDATE도 차트에 반영
          const now = new Date();
          setData((prev) => {
            const rawTs = now.getTime();
            const bucketTs = snapToBucket(rawTs);
            const timeLabel = new Date(bucketTs).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            const newPoint: PricePoint = {
              time: timeLabel,
              timestamp: bucketTs,
              price: newPrice,
              createdAt: now.toISOString(), // 원본 시간 저장
            };

            // 새 포인트를 추가하고 전체 데이터를 다시 정규화
            const withNewPoint = [...prev, newPoint];
            const normalized = normalizeData(withNewPoint);

            console.log("📊 [coins UPDATE] 차트 데이터 업데이트:", {
              이전_개수: prev.length,
              새_포인트: newPoint,
              정규화_후_개수: normalized.length,
            });

            // 오래된 데이터 제거 (성능 최적화)
            if (normalized.length > MAX_POINTS) {
              return normalized.slice(normalized.length - MAX_POINTS);
            }

            return normalized;
          });
        }
      )
      .subscribe((status, err) => {
        console.log("📊 [coins UPDATE] Realtime 구독 상태:", status);
        if (err) {
          console.error("❌ Realtime 구독 오류:", err);
        }
        if (status === "SUBSCRIBED") {
          console.log("✅ Realtime 구독 성공! coins 테이블의 UPDATE 이벤트를 수신합니다.");
        }
      });

    return () => {
      console.log("📊 Realtime 구독 해제");
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className="h-64 bg-gray-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500 text-sm">가격 데이터가 없습니다.</p>
      </div>
    );
  }

  // 색상 계산을 메모이제이션하여 불필요한 리렌더링 방지
  const { strokeColor } = useMemo(() => {
    const first = data[0]?.price ?? 0;
    const last = data[data.length - 1]?.price ?? 0;
    const isUp = last >= first;
    return { strokeColor: isUp ? "#22c55e" : "#ef4444" };
  }, [data]);

  return (
    <div className="h-64 bg-gray-900 rounded-lg p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={data}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <defs>
            <linearGradient id="vibeLine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.8} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#4b5563" }}
            minTickGap={16}
            allowDataOverflow={false}
            tickFormatter={(value: number) => {
              const date = new Date(value);
              return date.toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
            }}
          />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#4b5563" }}
            width={60}
            domain={["auto", "auto"]}
            allowDataOverflow={false}
          />
          <Tooltip
            content={({
              active,
              payload,
              label,
            }: {
              active?: boolean;
              payload?: Array<{ value?: number | string; payload?: PricePoint }>;
              label?: string;
            }) => {
              if (!active || !payload || payload.length === 0) {
                return null;
              }

              const data = payload[0]?.payload as PricePoint | undefined;
              const price = payload[0]?.value as number | undefined;
              
              // createdAt이 있으면 초 단위까지 표시, 없으면 label 사용
              let timeLabel = label ?? "";
              if (data?.createdAt) {
                try {
                  const date = new Date(data.createdAt);
                  timeLabel = date.toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });
                } catch (e) {
                  // 파싱 실패 시 원본 label 사용
                  timeLabel = label ?? "";
                }
              }

              return (
                <div
                  style={{
                    backgroundColor: "#030712",
                    borderRadius: 8,
                    border: "1px solid #374151",
                    padding: "8px 10px",
                  }}
                >
                  <p style={{ color: "#9ca3af", fontSize: 11, margin: "0 0 4px 0" }}>
                    {timeLabel}
                  </p>
                  <p style={{ color: "#e5e7eb", fontSize: 12, margin: 0 }}>
                    가격: ₩{typeof price === "number" ? price.toLocaleString() : "-"}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke={strokeColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "#0b1120", strokeWidth: 2 }}
            isAnimationActive={true}
            animationDuration={300}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


