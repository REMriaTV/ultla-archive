"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export function AuthHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setMounted(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!mounted) {
    return null;
  }

  /* ログイン中はヘッダーをシンプルに（サイドバーからマイページへ）。未ログイン時だけログインボタンを表示 */
  if (user) {
    return null;
  }

  /* ログイン画面では「ログインはこちら」は不要（すでにログインしようとしているため） */
  if (pathname === "/login") {
    return null;
  }

  return (
    <Link href="/login" className="shrink-0 text-sm hover:opacity-90">
      ログインはこちら
    </Link>
  );
}
