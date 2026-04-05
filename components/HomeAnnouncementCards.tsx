"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type HomeAnnouncementItem = {
  id: string;
  title: string;
  published_at: string | null;
};

/**
 * トップページ用お知らせカード（未ログイン・ログイン後どちらも表示）。
 * リンク先はログイン状態で切り替え。
 */
export function HomeAnnouncementCards({ items }: { items: HomeAnnouncementItem[] }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (items.length === 0) return null;
  if (isLoggedIn === null) return null;

  return (
    <div className="mb-4 space-y-3">
      {items.map((a) => {
        const publishedAt = a.published_at
          ? new Date(a.published_at).toLocaleDateString("ja-JP")
          : null;
        let isNew = false;
        if (a.published_at) {
          const date = new Date(a.published_at);
          if (!Number.isNaN(date.getTime())) {
            const diffMs = Date.now() - date.getTime();
            isNew = diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
          }
        }
        const href = isLoggedIn
          ? `/mypage/announcements/${encodeURIComponent(a.id)}`
          : "/login";
        return (
          <Link
            key={a.id}
            href={href}
            className="block rounded-lg border px-4 py-3 text-sm hover:opacity-95"
            style={{
              borderColor: "var(--accent)",
              background: "var(--card-hover)",
              color: "var(--fg-muted)",
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold tracking-wide" style={{ color: "var(--accent)" }}>
                お知らせ
              </span>
              {isNew && (
                <span className="rounded-full bg-[rgba(56,189,248,0.1)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                  NEW
                </span>
              )}
            </div>
            <div className="mt-1">
              <span className="font-medium" style={{ color: "var(--fg)" }}>
                {a.title}
              </span>
              {publishedAt && (
                <span className="ml-2 text-xs" style={{ color: "var(--fg-muted)" }}>
                  {publishedAt} 公開
                </span>
              )}
            </div>
            {!isLoggedIn && (
              <p className="mt-2 text-xs" style={{ color: "var(--fg-muted)" }}>
                ログインすると本文や一覧から詳しくご覧いただけます。
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
