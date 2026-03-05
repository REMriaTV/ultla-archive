"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Props = {
  title: string;
  publishedAt: string | null;
};

/**
 * ログイン中のみお知らせカードを表示する。
 * 表示有無はクライアントのセッションで判定するため、ログイン直後（OAuth 戻り等）でもリロードなしで表示される。
 */
export function AnnouncementCardWhenLoggedIn({ title, publishedAt }: Props) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isNew, setIsNew] = useState(false);

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

  useEffect(() => {
    if (!publishedAt) {
      setIsNew(false);
      return;
    }
    const date = new Date(publishedAt);
    if (Number.isNaN(date.getTime())) {
      setIsNew(false);
      return;
    }
    const now = Date.now();
    const diffMs = now - date.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    setIsNew(diffMs >= 0 && diffMs <= sevenDaysMs);
  }, [publishedAt]);

  if (isLoggedIn !== true) return null;

  return (
    <Link
      href="/mypage/announcements/latest"
      className="mb-4 block rounded-lg border px-4 py-3 text-sm hover:opacity-95"
      style={{
        borderColor: "var(--accent)",
        background: "var(--card-hover)",
        color: "var(--fg-muted)",
      }}
    >
      <div className="flex items-center gap-2">
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
          {title}
        </span>
        {publishedAt && (
          <span className="ml-2 text-xs" style={{ color: "var(--fg-muted)" }}>
            {publishedAt} 公開
          </span>
        )}
      </div>
    </Link>
  );
}
