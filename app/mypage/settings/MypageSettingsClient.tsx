"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const THEMES = [
  { id: "", label: "標準（白）" },
  { id: "light-water", label: "光・水" },
  { id: "dark-light", label: "深い光" },
  { id: "warm-refined", label: "洗練ウォーム" },
  { id: "blue-orange", label: "青と夕焼け" },
] as const;

function applyTheme(themeId: string) {
  const html = document.documentElement;
  if (themeId) {
    html.dataset.theme = themeId;
  } else {
    delete html.dataset.theme;
  }
}

export function MypageSettingsClient() {
  const router = useRouter();
  const [preferredTheme, setPreferredTheme] = useState("");
  const [saving, setSaving] = useState(false);
  const [logoutToast, setLogoutToast] = useState(false);

  useEffect(() => {
    fetch("/api/mypage/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.preferred_theme != null) setPreferredTheme(data.preferred_theme);
      })
      .catch(() => {});
  }, []);

  async function handleThemeChange(themeId: string) {
    setPreferredTheme(themeId);
    applyTheme(themeId);
    setSaving(true);
    try {
      await fetch("/api/mypage/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferred_theme: themeId }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { redirect: "manual" });
    await supabase.auth.signOut();
    setLogoutToast(true);
    router.push("/");
    router.refresh();
    // ログアウト後はトップを上端から表示する（遷移完了後もスクロールを確実にリセット）
    const scrollToTop = () => window.scrollTo(0, 0);
    requestAnimationFrame(scrollToTop);
    setTimeout(scrollToTop, 100);
  }

  useEffect(() => {
    if (!logoutToast) return;
    const t = setTimeout(() => setLogoutToast(false), 3000);
    return () => clearTimeout(t);
  }, [logoutToast]);

  return (
    <div
      className="flex flex-col gap-8 rounded-xl border p-5"
      style={{
        borderColor: "var(--border)",
        background: "var(--card)",
      }}
    >
      <section>
        <h2
          className="mb-3 text-sm font-semibold"
          style={{ color: "var(--fg)" }}
        >
          テーマ
        </h2>
        <p
          className="mb-3 text-xs"
          style={{ color: "var(--fg-muted)" }}
        >
          選択したテーマは保存され、次回以降も適用されます。
        </p>
        <div className="flex flex-wrap gap-2">
          {THEMES.map(({ id, label }) => {
            const isActive = preferredTheme === id;
            return (
              <button
                key={id || "default"}
                type="button"
                onClick={() => handleThemeChange(id)}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                style={
                  isActive
                    ? {
                        background: "var(--btn-primary-bg)",
                        color: "var(--btn-primary-fg)",
                      }
                    : {
                        background: "var(--card-hover)",
                        color: "var(--fg)",
                      }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2
          className="mb-3 text-sm font-semibold"
          style={{ color: "var(--fg)" }}
        >
          ログアウト
        </h2>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
          style={{
            borderColor: "var(--border)",
            color: "var(--fg)",
          }}
        >
          ログアウトする
        </button>
      </section>

      {logoutToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm shadow-lg"
          style={{
            background: "var(--card)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
          }}
        >
          ログアウトしました
        </div>
      )}
    </div>
  );
}
