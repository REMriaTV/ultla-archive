"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * ヘッダー右上の検索バー。Enterでトップへ ?q= を付けて遷移し、トップの検索セクションで結果表示。
 */
export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="hidden min-w-0 max-w-[200px] sm:block sm:max-w-[260px]">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="キーワードで検索..."
        className="w-full rounded-lg border py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-1"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg)",
          color: "var(--fg)",
        }}
        aria-label="スライド検索"
        suppressHydrationWarning
      />
    </form>
  );
}
