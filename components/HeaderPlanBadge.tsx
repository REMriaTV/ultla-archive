"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { SHOW_PAID_PLAN_UI } from "@/lib/feature-flags";

type Plan = "free" | "basic" | "pro" | "advance" | "premium";

const PLAN_LABELS: Record<Plan, string> = {
  free: "FREE",
  basic: "BASIC",
  pro: "PRO",
  advance: "ADVANCE",
  premium: "ADVANCE",
};

/** ヘッダーに表示する現在の加入プラン（FREE／BASIC／PRO／ADVANCE または ゲスト） */
export function HeaderPlanBadge() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user);
      setMounted(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setPlan(null);
      return;
    }
    setPlan("free"); // 取得前は FREE 表示
    let cancelled = false;
    fetch("/api/mypage/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.plan && PLAN_LABELS[data.plan as Plan]) {
          setPlan(data.plan as Plan);
        } else if (!cancelled) {
          setPlan("free");
        }
      })
      .catch(() => {
        if (!cancelled) setPlan("free");
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  if (!SHOW_PAID_PLAN_UI) return null;
  if (!mounted) return null;

  const label = !isLoggedIn
    ? "FREE（ゲスト）"
    : plan !== null
      ? PLAN_LABELS[plan]
      : "FREE";

  return (
    <span
      className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium"
      style={{
        borderColor: "var(--border)",
        background: "var(--card)",
        color: "var(--fg-muted)",
      }}
      aria-label={`現在のプラン: ${label}`}
      title={`現在のプラン: ${label}`}
    >
      {label}
    </span>
  );
}
