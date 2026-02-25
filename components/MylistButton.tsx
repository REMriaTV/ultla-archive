"use client";

import Link from "next/link";
import { useState } from "react";

interface MylistButtonProps {
  slideId: string;
  initialInMylist: boolean;
}

export function MylistButton({ slideId, initialInMylist }: MylistButtonProps) {
  const [inMylist, setInMylist] = useState(initialInMylist);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (inMylist) {
        const res = await fetch(`/api/mypage/mylist?slide_id=${encodeURIComponent(slideId)}`, {
          method: "DELETE",
        });
        if (res.ok) setInMylist(false);
      } else {
        const res = await fetch("/api/mypage/mylist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slide_id: slideId }),
        });
        if (res.ok) setInMylist(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
      style={{
        borderColor: "var(--border)",
        background: inMylist ? "var(--card-hover)" : "var(--card)",
        color: "var(--fg)",
      }}
      aria-pressed={inMylist}
    >
      <span aria-hidden>{inMylist ? "★" : "☆"}</span>
      {inMylist ? "マイリストから外す" : "マイリストに追加"}
    </button>
  );
}

/** 未ログイン時用の案内 */
export function MylistLoginPrompt() {
  return (
    <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
      <Link href="/login" className="underline hover:opacity-90">
        ログイン
      </Link>
      するとマイリストに追加できます。
    </p>
  );
}
