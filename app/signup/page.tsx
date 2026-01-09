"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email || !password || !confirmPassword) {
      setError("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      
      // emailRedirectTo 옵션 제거 (이메일 전송 오류 방지)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      // 에러가 발생해도 계정이 생성되었을 수 있음
      if (signUpError) {
        console.log("회원가입 에러:", signUpError);
        console.log("생성된 사용자:", data?.user);
        
        // 계정이 생성되었는지 확인
        if (data?.user) {
          // 계정이 생성되었다면 자동으로 로그인 시도
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) {
            // 로그인 실패 시 로그인 페이지로 이동
            setMessage(
              "회원가입이 완료되었습니다. 로그인 페이지로 이동합니다..."
            );
            setTimeout(() => {
              router.push("/login");
            }, 2000);
          } else {
            // 로그인 성공 시 메인 페이지로 이동
            setMessage("회원가입 및 로그인이 완료되었습니다!");
            setTimeout(() => {
              router.push("/");
            }, 1000);
          }
        } else {
          // 계정이 생성되지 않은 경우
          if (signUpError.message.includes("email") || signUpError.message.includes("confirmation")) {
            setError("이메일 전송 오류가 발생했습니다. Supabase 대시보드에서 이메일 확인을 비활성화해주세요.");
          } else {
            setError(signUpError.message);
          }
        }
        return;
      }

      // 성공한 경우 - 계정이 생성되었으면 자동 로그인 시도
      if (data?.user) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setMessage("회원가입이 완료되었습니다. 로그인 페이지로 이동합니다...");
          setTimeout(() => {
            router.push("/login");
          }, 2000);
        } else {
          setMessage("회원가입 및 로그인이 완료되었습니다!");
          setTimeout(() => {
            router.push("/");
          }, 1000);
        }
      } else {
        setMessage("회원가입이 완료되었습니다. 로그인 페이지로 이동합니다...");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err) {
      console.error("회원가입 오류:", err);
      const errorMessage = err instanceof Error ? err.message : "회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">회원가입</CardTitle>
          <CardDescription>
            이메일과 비밀번호를 입력하여 Vibe Coin 모의 투자 게임을 시작해보세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                이메일
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                비밀번호
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                비밀번호 확인
              </label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            {message && (
              <p className="text-sm text-green-600 dark:text-green-400">
                {message}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "회원가입 중..." : "회원가입"}
            </Button>
          </form>

          <div className="mt-6 text-sm text-center text-gray-600 dark:text-gray-400">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              로그인하기
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


