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
      className="mb-6 rounded-lg border px-4 py-3 text-sm"
      style={{
        borderColor: "var(--border)",
        background: "var(--card)",
        color: "var(--fg-muted)",
      }}
    >
      一部のスライドは招待コードで全ページ閲覧できます（招待コードには有効期限があります）。画面上部の
      <span className="mx-1 font-medium" style={{ color: "var(--fg)" }}>
        招待コード
      </span>
      欄にお持ちのコードを入力し、
      <Link href="/login" className="ml-1 font-medium hover:opacity-80" style={{ color: "var(--fg)" }}>
        ログイン
      </Link>
      または会員登録すると、対応するスライドがマイページから全ページ閲覧できます。
    </p>
  );
}
