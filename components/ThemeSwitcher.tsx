"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useCallback, useState } from "react";

const THEMES = [
  { id: "", label: "標準（白）" },
  { id: "light-water", label: "光・水" },
  { id: "dark-light", label: "深い光" },
  { id: "warm-refined", label: "洗練ウォーム" },
  { id: "blue-orange", label: "青と夕焼け" },
] as const;

export function ThemeSwitcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [resolvedTheme, setResolvedTheme] = useState("");

  const applyTheme = useCallback((themeId: string) => {
    const html = document.documentElement;
    if (themeId) {
      html.dataset.theme = themeId;
    } else {
      delete html.dataset.theme;
    }
  }, []);

  useEffect(() => {
    const themeParam = searchParams.get("theme");
    if (themeParam !== null) {
      applyTheme(themeParam);
      setResolvedTheme(themeParam);
    } else {
      setResolvedTheme(document.documentElement.dataset.theme ?? "");
    }
  }, [searchParams, applyTheme]);

  const current = resolvedTheme;

  const themeUrl = (id: string) =>
    `${pathname}?theme=${encodeURIComponent(id)}`;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--fg-muted)]">
        テーマプロトタイプ
      </p>
      <div className="flex flex-wrap gap-1.5">
        {THEMES.map(({ id, label }) => {
          const isActive = current === id;
          return (
            <a
              key={id || "default"}
              href={themeUrl(id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--card-hover)] text-[var(--fg)] hover:opacity-90"
              }`}
              style={
                isActive
                  ? { background: "var(--btn-primary-bg)", color: "var(--btn-primary-fg)" }
                  : undefined
              }
            >
              {label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
