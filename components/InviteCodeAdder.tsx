"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

/**
 * ログイン後のユーザーが招待コードを入力・追加するUI
 */
export function InviteCodeAdder() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setMessage({ type: "error", text: "招待コードを入力してください" });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/invite/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: "success", text: "招待コードを登録しました。スライドが表示されます。" });
        setCode("");
        router.refresh();
        setTimeout(() => {
          setOpen(false);
          setMessage(null);
        }, 1500);
      } else {
        setMessage({ type: "error", text: data.error || "招待コードの登録に失敗しました" });
      }
    } catch {
      setMessage({ type: "error", text: "エラーが発生しました" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 text-sm transition-colors hover:opacity-80"
        style={{ color: "var(--fg-muted)" }}
      >
        <span className="hidden sm:inline">招待コードを追加</span>
        <span className="sm:hidden">招待コード</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-neutral-900">招待コードを入力</h2>
            <p className="mt-1 text-sm text-neutral-600">
              セミナー等でお伝えしたコードを入力すると、紐づいたスライドが閲覧できます。
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="invite-code" className="block text-sm font-medium text-neutral-700">
                  招待コード
                </label>
                <input
                  id="invite-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="例: shoku-iku-hayama"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900"
                  autoFocus
                />
              </div>
              {message && (
                <p className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
                  {message.text}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setCode("");
                    setMessage(null);
                  }}
                  className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                >
                  {loading ? "登録中..." : "登録"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
