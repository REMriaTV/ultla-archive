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

  if (isLoggedIn !== true) return null;

  return (
    <Link
      href="/mypage/announcements"
      className="mb-4 block rounded-lg border px-4 py-3 text-sm hover:opacity-90"
      style={{
        borderColor: "var(--border)",
        background: "var(--card)",
        color: "var(--fg-muted)",
      }}
    >
      <span className="font-medium" style={{ color: "var(--fg)" }}>
        {title}
      </span>
      {publishedAt && (
        <span className="ml-2 text-xs" style={{ color: "var(--fg-muted)" }}>
          {publishedAt} 公開
        </span>
      )}
    </Link>
  );
}
