"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteCodeForm({ className }: { className?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
        setMessage({
          type: "success",
          text: "招待コードを登録しました。スライドが表示されます。",
        });
        setCode("");
        router.refresh();
      } else {
        setMessage({
          type: "error",
          text: data.error || "招待コードの登録に失敗しました",
        });
      }
    } catch {
      setMessage({ type: "error", text: "エラーが発生しました" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-wrap items-end gap-3 ${className ?? ""}`}
    >
      <div className="min-w-0 flex-1">
        <label
          htmlFor="mypage-invite-code"
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--fg-muted)" }}
        >
          招待コードを追加
        </label>
        <input
          id="mypage-invite-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="例: ULTLA2025"
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg)",
            color: "var(--fg)",
          }}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        style={{
          background: "var(--btn-primary-bg)",
          color: "var(--btn-primary-fg)",
        }}
      >
        {loading ? "登録中..." : "追加"}
      </button>
      {message && (
        <p
          className="w-full text-sm"
          style={{
            color:
              message.type === "success"
                ? "var(--accent)"
                : "var(--fg-muted)",
          }}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
