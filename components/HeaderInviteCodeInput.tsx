"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

/**
 * ヘッダー右側の招待コード入力欄。
 * - ログイン中: そのまま招待コードを検証して付与
 * - ゲスト: コードを検証のうえ localStorage に保存し、ログイン画面へ案内
 */
export function HeaderInviteCodeInput() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    try {
      // まずコードの有効性だけ検証
      const validateRes = await fetch("/api/invite/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const validateData = await validateRes.json().catch(() => ({}));
      if (!validateRes.ok || validateData.valid !== true) {
        alert(validateData.error || "無効な招待コードです");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // ログイン中はそのまま付与
        const grantRes = await fetch("/api/invite/grant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: trimmed }),
        });
        const grantData = await grantRes.json().catch(() => ({}));
        if (!grantRes.ok || !grantData.success) {
          alert(grantData.error || "招待コードの登録に失敗しました");
          return;
        }
        setCode("");
        router.refresh();
      } else {
        // ゲスト: ログイン後に処理するため pending_invite_code に保存してログイン画面へ
        if (typeof window !== "undefined") {
          localStorage.setItem("pending_invite_code", trimmed);
        }
        router.push("/login");
      }
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "招待コードの処理中にエラーが発生しました"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="hidden items-center gap-1 sm:flex"
      aria-label="招待コード入力"
    >
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="招待コード"
        className="w-32 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 outline-none focus:border-neutral-500 focus:ring-0"
      />
      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        適用
      </button>
    </form>
  );
}

