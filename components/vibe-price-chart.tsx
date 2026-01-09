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
const BUCKET_MS = 3000; // 3초 단위 버킷
const ONE_HOUR_MS = 60 * 60 * 1000; // 1시간 (밀리초)

// 타임스탬프를 5초 단위 버킷으로 정규화
function snapToBucket(timestamp: number): number {
  return Math.floor(timestamp / BUCKET_MS) * BUCKET_MS;
}

// 최근 1시간 이내 데이터만 필터링하는 함수
function filterLastHour(points: PricePoint[]): PricePoint[] {
  const now = Date.now();
  const oneHourAgo = now - ONE_HOUR_MS;
  
  return points.filter((point) => {
    const ts = point.timestamp ?? (point.createdAt ? new Date(point.createdAt).getTime() : 0);
    return ts >= oneHourAgo;
  });
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
        price: Math.round(point.price), // 가격을 정수로 변환
      });
    }
  }

  // 버킷을 타임스탬프 순으로 정렬하여 배열로 변환
  const result = Array.from(bucketMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([_, point]) => point);
  
  // 최근 1시간 이내 데이터만 필터링
  return filterLastHour(result);
}

export function VibePriceChart({ initialData }: Props) {
  const [data, setData] = useState<PricePoint[]>(initialData ?? []);

  useEffect(() => {
    // 초기 데이터가 바뀌면 5초 버킷 기준으로 정규화해서 동기화
    if (!initialData || initialData.length === 0) {
      setData([]);
      return;
    }

    // normalizeData 함수를 사용하여 정규화 (이미 1시간 필터링 포함)
    const normalized = normalizeData(initialData);
    // 추가로 1시간 필터링 적용 (이중 체크)
    const filtered = filterLastHour(normalized);
    setData(filtered);
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
          const row = payload.new as { price?: number; created_at?: string };
          const price = Math.round(Number(row.price ?? NaN));
          const createdAt = row.created_at;

          if (!Number.isFinite(price) || !createdAt) {
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
            
            // 최근 1시간 이내 데이터만 필터링
            const filtered = filterLastHour(normalized);

            // 오래된 데이터 제거 (성능 최적화)
            if (filtered.length > MAX_POINTS) {
              return filtered.slice(filtered.length - MAX_POINTS);
            }

            return filtered;
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
          const newPrice = Math.round(Number(
            (payload.new as { current_price?: number }).current_price ?? NaN
          ));
          if (!Number.isFinite(newPrice)) {
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
            
            // 최근 1시간 이내 데이터만 필터링
            const filtered = filterLastHour(normalized);

            // 오래된 데이터 제거 (성능 최적화)
            if (filtered.length > MAX_POINTS) {
              return filtered.slice(filtered.length - MAX_POINTS);
            }

            return filtered;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
  }, []);

  // 주기적으로 1시간 이전 데이터 제거 (1분마다 체크)
  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const filtered = filterLastHour(prev);
        if (filtered.length !== prev.length) {
        }
        return filtered;
      });
    }, 60000); // 1분마다 체크

    return () => clearInterval(interval);
  }, []);

  // 데이터 검증 및 색상 계산을 메모이제이션
  const { strokeColor, validData } = useMemo(() => {
    // 먼저 최근 1시간 이내 데이터만 필터링
    const lastHourData = filterLastHour(data);
    
    // 유효한 데이터만 필터링 (타임스탬프와 가격이 유효한 것만)
    const filtered = lastHourData.filter(
      (point) =>
        point &&
        typeof point.timestamp === "number" &&
        !isNaN(point.timestamp) &&
        isFinite(point.timestamp) &&
        point.timestamp > 0 &&
        typeof point.price === "number" &&
        !isNaN(point.price) &&
        isFinite(point.price) &&
        point.price > 0
    );

    if (filtered.length === 0) {
      return { strokeColor: "#22c55e", validData: [] };
    }

    // 타임스탬프 기준으로 다시 정렬 (중복 제거)
    const sorted = [...filtered].sort((a, b) => a.timestamp - b.timestamp);
    
    // 같은 타임스탬프가 있으면 가장 최신 가격만 유지
    const uniqueData: PricePoint[] = [];
    const seenTimestamps = new Set<number>();
    
    // 역순으로 순회하여 같은 타임스탬프 중 가장 최신 것만 유지
    for (let i = sorted.length - 1; i >= 0; i--) {
      const point = sorted[i];
      if (!seenTimestamps.has(point.timestamp)) {
        seenTimestamps.add(point.timestamp);
        // 가격을 정수로 변환하여 저장
        uniqueData.unshift({
          ...point,
          price: Math.round(point.price),
        }); // 앞에 추가하여 순서 유지
      }
    }

    if (uniqueData.length === 0) {
      return { strokeColor: "#22c55e", validData: [] };
    }

    const first = uniqueData[0]?.price ?? 0;
    const last = uniqueData[uniqueData.length - 1]?.price ?? 0;
    const isUp = last >= first;
    return {
      strokeColor: isUp ? "#22c55e" : "#ef4444",
      validData: uniqueData,
    };
  }, [data]);

  // 유효한 데이터가 없으면 표시
  if (!validData || validData.length === 0) {
    return (
      <div className="h-64 bg-gray-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500 text-sm">가격 데이터가 없습니다.</p>
      </div>
    );
  }

  // 도메인 계산 (데이터가 하나일 때도 처리)
  const timestamps = validData.map((d) => d.timestamp).filter((ts) => isFinite(ts) && !isNaN(ts));
  const prices = validData.map((d) => d.price).filter((p) => isFinite(p) && !isNaN(p) && p > 0);
  
  if (timestamps.length === 0 || prices.length === 0) {
    return (
      <div className="h-64 bg-gray-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500 text-sm">가격 데이터가 없습니다.</p>
      </div>
    );
  }

  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const pricePadding = priceRange > 0 ? Math.ceil(priceRange * 0.1) : Math.max(Math.ceil(maxPrice * 0.1), 50); // 10% 패딩, 최소 50 (정수로)

  return (
    <div className="h-64 bg-gray-900 rounded-lg p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={validData}
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
            scale="linear"
            domain={[minTimestamp, maxTimestamp]}
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#4b5563" }}
            minTickGap={16}
            allowDataOverflow={false}
            tickFormatter={(value: number) => {
              try {
                const date = new Date(value);
                if (isNaN(date.getTime())) return "";
                return date.toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
              } catch {
                return "";
              }
            }}
          />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#4b5563" }}
            width={60}
            domain={[
              Math.max(0, Math.floor(minPrice - pricePadding)),
              Math.ceil(maxPrice + pricePadding)
            ]}
            allowDataOverflow={false}
            tickFormatter={(value: number) => {
              if (typeof value !== "number" || !isFinite(value) || isNaN(value)) {
                return "";
              }
              // 정수로만 표시 (소수점 제거)
              return Math.round(value).toString();
            }}
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
                } catch (e: unknown) {
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
                    가격: ₩{typeof price === "number" ? Math.round(price).toLocaleString() : "-"}
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
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


