// price_history 테이블 존재 여부 및 Realtime 활성화 확인 유틸리티

import { createClient } from "./client";

export async function checkPriceHistoryTable() {
  const supabase = createClient();

  try {
    // 테이블 존재 여부 확인 (SELECT 쿼리로 테스트)
    const { data, error } = await supabase
      .from("price_history")
      .select("id")
      .limit(1);

    if (error) {
      console.error("❌ price_history 테이블 확인 실패:", error);
      return {
        exists: false,
        error: error.message,
        suggestion: "supabase/price_history_table.sql 파일을 Supabase SQL Editor에서 실행하세요.",
      };
    }

    console.log("✅ price_history 테이블 존재 확인됨");
    return {
      exists: true,
      data,
    };
  } catch (err) {
    console.error("❌ price_history 테이블 확인 중 예외:", err);
    const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류";
    return {
      exists: false,
      error: errorMessage,
      suggestion: "supabase/price_history_table.sql 파일을 Supabase SQL Editor에서 실행하세요.",
    };
  }
}

