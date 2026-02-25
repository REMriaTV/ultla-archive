"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const msg = searchParams.get("message");
    if (msg) {
      setMessage({ type: "error", text: decodeURIComponent(msg) });
    }
  }, [searchParams]);

  async function validateInviteCode(code: string): Promise<boolean> {
    const res = await fetch("/api/invite/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    const data = await res.json();
    return data.valid === true;
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setMessage(null);
    try {
      if (mode === "signup" && inviteCode.trim()) {
        const code = inviteCode.trim();
        const valid = await validateInviteCode(code);
        if (!valid) {
          setMessage({ type: "error", text: "無効な招待コードです" });
          setLoading(false);
          return;
        }
        localStorage.setItem("pending_invite_code", code);
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "エラーが発生しました",
      });
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === "signup") {
        const code = inviteCode.trim();
        if (code) {
          const valid = await validateInviteCode(code);
          if (!valid) {
            setMessage({ type: "error", text: "無効な招待コードです" });
            setLoading(false);
            return;
          }
          localStorage.setItem("pending_invite_code", code);
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        if (data.session && code) {
          const res = await fetch("/api/invite/grant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const resData = await res.json();
          if (resData.success) {
            localStorage.removeItem("pending_invite_code");
          }
        }
        if (data.session) {
          router.push("/");
          router.refresh();
          return;
        }
        setMessage({
          type: "success",
          text: "確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "エラーが発生しました",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-neutral-900">
          {mode === "login" ? "ログイン" : "無料会員登録"}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          {mode === "login"
            ? "登録済みの方はメールアドレスとパスワードでログイン"
            : "メールアドレスで無料会員登録（全スライド閲覧可能）"}
        </p>

        {mode === "signup" && (
          <div className="mt-6">
            <label htmlFor="invite" className="block text-sm font-medium text-neutral-700">
              招待コード（任意）
            </label>
            <input
              id="invite"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="お持ちの場合は入力（登録後マイページからも追加できます）"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
            />
          </div>
        )}

        <p className="mt-4 text-xs text-neutral-500 leading-relaxed">
          「Google でログイン」を押すと、セキュリティのため認証サービスの画面が表示されます。「supabase.co」という長いアドレスが出ても問題ありません。安全なログイン処理の一環です。
        </p>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-3 font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google でログイン
        </button>

        <div className="mt-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="text-xs text-neutral-500">または</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
            />
            {mode === "signup" && (
              <p className="mt-1 text-xs text-neutral-500">6文字以上</p>
            )}
          </div>
          {message && (
            <p
              className={`text-sm ${
                message.type === "success" ? "text-green-600" : "text-red-600"
              }`}
            >
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-neutral-900 px-4 py-3 font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? "処理中..." : mode === "login" ? "ログイン" : "登録"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "login" ? "signup" : "login"));
            setInviteCode("");
            setMessage(null);
          }}
          className="mt-4 w-full text-center text-sm text-neutral-600 hover:text-neutral-900"
        >
          {mode === "login" ? "アカウントをお持ちでない方 → 無料登録" : "既に登録済みの方 → ログイン"}
        </button>
      </div>

      <Link
        href="/"
        className="mt-6 text-sm text-neutral-500 hover:text-neutral-700"
      >
        ゲストのまま閲覧する
      </Link>
    </div>
  );
}
