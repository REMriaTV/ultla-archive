"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

/**
 * ログイン後、招待コードでアクセス付与が必要なユーザーを処理する。
 * Google OAuth やメール確認後のリダイレクト時に実行。
 * ログイン直後にサーバー描画を同期させるため、ユーザーがいる場合は1回 router.refresh() する。
 */
export function InviteGrantChecker() {
  const router = useRouter();
  const refreshedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data: { user } } = await supabase.auth.getUser();

      // セッションが遅れて復元される場合: 少し待ってから再チェックし、その時点でユーザーがいれば refresh
      if (!user) {
        await new Promise((r) => setTimeout(r, 250));
        if (cancelled) return;
        const { data: { user: userDelayed } } = await supabase.auth.getUser();
        if (userDelayed && !refreshedRef.current) {
          refreshedRef.current = true;
          router.refresh();
        }
        return;
      }

      if (cancelled) return;

      // Google OAuth 直後のリダイレクト: クライアントでセッションが確定したらサーバーを再描画
      if (typeof window !== "undefined" && window.location.hash) {
        refreshedRef.current = true;
        router.refresh();
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("access_granted")
        .eq("id", user.id)
        .single();

      if (profile?.access_granted || cancelled) return;

      const code = localStorage.getItem("pending_invite_code");
      if (!code) {
        // 招待コードなしでもログイン完了とする（コードはログイン後マイページで追加可能）
        return;
      }

      const res = await fetch("/api/invite/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const resData = await res.json();

      if (cancelled) return;

      if (resData.success) {
        localStorage.removeItem("pending_invite_code");
        router.refresh();
      } else {
        localStorage.removeItem("pending_invite_code");
        router.push(`/login?message=${encodeURIComponent(resData.error || "招待コードの処理に失敗しました")}`);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
