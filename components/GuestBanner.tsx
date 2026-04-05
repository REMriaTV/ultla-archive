"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/**
 * ゲストのときだけ表示する案内バナー。
 * 認証状態をクライアントで購読するため、OAuth ログイン直後もリロードなしで消える。
 */
export function GuestBanner() {
  const [isGuest, setIsGuest] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsGuest(!session?.user);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsGuest(!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (isGuest === null || !isGuest) return null;

  return (
    <p
      className="mb-6 rounded-lg border px-4 py-3 text-sm leading-relaxed"
      style={{
        borderColor: "var(--border)",
        background: "var(--card)",
        color: "var(--fg-muted)",
      }}
    >
      ログインいただくと、各コンテンツの公開設定に応じて、スライドや資料をより多くのページまでご覧いただける場合があります。無料の会員登録からもご利用いただけます。
      <Link
        href="/login"
        className="ml-1 font-medium underline-offset-2 hover:opacity-90 hover:underline"
        style={{ color: "var(--fg)" }}
      >
        ログイン・会員登録はこちら
      </Link>
      からお進みください。
    </p>
  );
}
