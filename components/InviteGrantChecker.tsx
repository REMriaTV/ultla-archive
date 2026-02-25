"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

/**
 * ログイン後、招待コードでアクセス付与が必要なユーザーを処理する。
 * Google OAuth やメール確認後のリダイレクト時に実行。
 */
export function InviteGrantChecker() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      // Google OAuth 直後のリダイレクト: クライアントでセッションが確定したらサーバーを再描画
      if (typeof window !== "undefined" && window.location.hash) {
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
