"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type MainHeaderProps = {
  email?: string | null;
};

export function MainHeader({ email }: MainHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  };

  // 로그인 상태일 때: 이메일 + 로그아웃 버튼
  if (email) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {email}
        </span>
        <Button
          variant="outline"
          type="button"
          onClick={handleLogout}
          size="sm"
        >
          로그아웃
        </Button>
      </div>
    );
  }

  // 비로그인 상태일 때: 로그인 / 시작하기 버튼
  return (
    <div className="flex gap-2">
      <Link href="/login">
        <Button 
          variant="outline" 
          type="button"
          size="sm"
        >
          로그인
        </Button>
      </Link>
      <Link href="/signup">
        <Button 
          type="button"
          size="sm"
          className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
        >
          시작하기
        </Button>
      </Link>
    </div>
  );
}


