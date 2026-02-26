"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const SETTINGS_NAV = [
  { label: "アカウント情報", href: "/mypage/account" },
  { label: "マイリスト", href: "/mypage/mylist" },
  { label: "招待コード", href: "/mypage/invite-codes" },
  { label: "設定", href: "/mypage/settings" },
  { label: "お問い合わせ", href: "/mypage/contact" },
] as const;

interface GenreTypeRow {
  id: string;
  name: string;
  sort_order: number;
}

interface SidebarProgram {
  id: string;
  name: string;
  slug: string;
  genre_type: string;
}

export function MypageSidebar() {
  const pathname = usePathname();
  const [programs, setPrograms] = useState<SidebarProgram[]>([]);
  const [genreTypes, setGenreTypes] = useState<GenreTypeRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/mypage/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setIsAdmin(data?.is_admin === true))
      .catch(() => setIsAdmin(false));
  }, [pathname]);

  // ログイン直後は pathname だけでは refetch が走らないことがあるため、マウント後少し遅れて再取得
  useEffect(() => {
    const t = window.setTimeout(() => {
      fetch("/api/mypage/profile")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setIsAdmin((prev) => (data?.is_admin === true ? true : prev)))
        .catch(() => {});
    }, 600);
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    fetch("/api/programs")
      .then((res) => res.ok ? res.json() : [])
      .then((data: SidebarProgram[]) => setPrograms(data ?? []))
      .catch(() => setPrograms([]));
  }, []);

  useEffect(() => {
    fetch("/api/genre-types")
      .then((res) => res.ok ? res.json() : [])
      .then((data: GenreTypeRow[]) => setGenreTypes(Array.isArray(data) ? data : []))
      .catch(() => setGenreTypes([]));
  }, []);

  const byGenre = new Map<string, SidebarProgram[]>();
  for (const p of programs) {
    const g = p.genre_type ?? "program";
    const list = byGenre.get(g) ?? [];
    list.push(p);
    byGenre.set(g, list);
  }
  const genreOrder = genreTypes.map((g) => g.id);
  const hasAnyProgram = programs.length > 0;

  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-header)",
      }}
    >
      <div className="flex flex-col gap-6 p-4">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight"
          style={{ color: "var(--fg)" }}
        >
          SPACE ARCHIVE
        </Link>

        <nav className="flex flex-col gap-1">
          <p
            className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            ナビ
          </p>
          <div className="flex flex-col gap-0.5">
            <Link
              href="/"
              className="rounded-lg px-3 py-2 pl-5 text-sm transition-colors hover:opacity-90"
              style={{
                color: pathname === "/" ? "var(--fg)" : "var(--fg-muted)",
                background:
                  pathname === "/" ? "var(--card-hover)" : "transparent",
              }}
            >
              ホーム
            </Link>
          </div>
        </nav>

        <nav className="flex flex-col gap-1">
          <p
            className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            マイページ
          </p>
          <div className="flex flex-col gap-0.5 pl-3">
            {SETTINGS_NAV.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="block rounded-lg px-3 py-2 pl-4 text-sm transition-colors hover:opacity-90 cursor-pointer"
                style={{
                  color: pathname === href ? "var(--fg)" : "var(--fg-muted)",
                  background:
                    pathname === href ? "var(--card-hover)" : "transparent",
                }}
              >
                {label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="block rounded-lg px-3 py-2 pl-4 text-sm transition-colors hover:opacity-90 cursor-pointer"
                style={{
                  color: pathname.startsWith("/admin") ? "var(--fg)" : "var(--fg-muted)",
                  background:
                    pathname.startsWith("/admin") ? "var(--card-hover)" : "transparent",
                }}
              >
                管理
              </Link>
            )}
          </div>
        </nav>

        {hasAnyProgram && (
          <nav className="flex flex-col gap-1">
            <div className="flex flex-col gap-0.5">
              {genreOrder.map((genre) => {
                const list = byGenre.get(genre) ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={genre} className="flex flex-col gap-0.5 pl-3">
                    <span
                      className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      {genreTypes.find((g) => g.id === genre)?.name ?? genre}
                    </span>
                    {list.map((p) => (
                      <Link
                        key={p.id}
                        href={`/program/${encodeURIComponent(p.slug || p.id)}`}
                        className="block rounded-lg px-3 py-2 pl-4 text-base font-normal leading-normal transition-colors hover:opacity-90"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        {p.name}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </aside>
  );
}
