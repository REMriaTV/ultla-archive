"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
const SETTINGS_NAV = [
  { label: "アカウント情報", href: "/mypage/account" },
  { label: "マイリスト", href: "/mypage/mylist" },
  { label: "招待コード", href: "/mypage/invite-codes" },
  { label: "設定", href: "/mypage/settings" },
  { label: "お問い合わせ", href: "/mypage/contact" },
  { label: "お知らせ", href: "/mypage/announcements" },
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

interface MobileSidebarProps {
  onClose: () => void;
}

function MobileSidebar({ onClose }: MobileSidebarProps) {
  const pathname = usePathname();
  const [programs, setPrograms] = useState<SidebarProgram[]>([]);
  const [genreTypes, setGenreTypes] = useState<GenreTypeRow[]>([]);
  const [openMypage, setOpenMypage] = useState(true);
  const [openGenre, setOpenGenre] = useState<Record<string, boolean>>({});
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/mypage/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setIsAdmin(data?.is_admin === true))
      .catch(() => setIsAdmin(false));
  }, [pathname]);

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
      .then((res) => (res.ok ? res.json() : []))
      .then((data: SidebarProgram[]) => setPrograms(data ?? []))
      .catch(() => setPrograms([]));
  }, []);

  useEffect(() => {
    fetch("/api/genre-types")
      .then((res) => res.ok ? res.json() : [])
      .then((data: GenreTypeRow[]) => {
        if (Array.isArray(data)) {
          setGenreTypes(data);
          setOpenGenre((prev) => {
            const next = { ...prev };
            data.forEach((g, i) => {
              if (next[g.id] === undefined) next[g.id] = i === 0;
            });
            return next;
          });
        }
      })
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

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{
        background: "var(--bg-header)",
        color: "var(--fg)",
        borderRight: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          href="/"
          onClick={onClose}
          className="text-base font-bold tracking-tight"
          style={{ color: "var(--fg)" }}
        >
          SPACE ARCHIVE
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/5"
          aria-label="メニューを閉じる"
        >
          <span
            className="block h-4 w-4 rotate-45 border-r-2 border-t-2"
            style={{ borderColor: "var(--fg-muted)" }}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-6">
        {/* ホーム */}
        <div className="mb-3">
          <Link
            href="/"
            onClick={onClose}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-white/5"
            style={{
              color: pathname === "/" ? "var(--fg)" : "var(--fg-muted)",
              background:
                pathname === "/" ? "var(--card-hover)" : "transparent",
            }}
          >
            <span className="text-base">🏠</span>
            <span>ホーム</span>
          </Link>
        </div>

        {/* マイページ（折り畳み） */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setOpenMypage((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-wider hover:bg-white/5"
            style={{ color: "var(--fg-muted)" }}
          >
            <span>マイページ</span>
            <span
              className={`transition-transform ${
                openMypage ? "rotate-180" : "rotate-0"
              }`}
            >
              ▼
            </span>
          </button>
          {openMypage && (
            <div
              className="mt-1 flex flex-col gap-0.5 border-l pl-3"
              style={{ borderColor: "var(--border)" }}
            >
              {SETTINGS_NAV.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-white/5"
                  style={{
                    color:
                      pathname === href ? "var(--fg)" : "var(--fg-muted)",
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
                  onClick={onClose}
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-white/5"
                  style={{
                    color:
                      pathname.startsWith("/admin") ? "var(--fg)" : "var(--fg-muted)",
                    background:
                      pathname.startsWith("/admin") ? "var(--card-hover)" : "transparent",
                  }}
                >
                  管理
                </Link>
              )}
            </div>
          )}
        </div>

        {/* プログラム / 組織 / 自治体（折り畳み） */}
        {genreOrder.map((genre) => {
          const list = byGenre.get(genre) ?? [];
          if (list.length === 0) return null;
          const isOpen = openGenre[genre] ?? false;
          return (
            <div key={genre} className="mb-4">
              <button
                type="button"
                onClick={() =>
                  setOpenGenre((prev) => ({ ...prev, [genre]: !isOpen }))
                }
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-wider hover:bg-white/5"
                style={{ color: "var(--fg-muted)" }}
              >
                <span>{genreTypes.find((g) => g.id === genre)?.name ?? genre}</span>
                <span
                  className={`transition-transform ${
                    isOpen ? "rotate-180" : "rotate-0"
                  }`}
                >
                  ▼
                </span>
              </button>
              {isOpen && (
                <div
                  className="mt-1 flex flex-col gap-0.5 border-l pl-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  {list.map((p) => (
                    <Link
                      key={p.id}
                      href={`/program/${p.slug || p.id}`}
                      onClick={onClose}
                      className="block rounded-lg px-3 py-2 text-sm hover:bg-white/5"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      {p.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MobileSidebarMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openMenu = () => setOpen(true);

  const overlay = open ? (
    <div
      className="fixed inset-0 z-[100] md:hidden"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
      aria-modal="true"
      role="dialog"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={() => setOpen(false)}
        aria-label="メニューを閉じる"
      />
      <div
        className="absolute top-0 left-0 bottom-0 z-10 w-[min(18rem,85vw)] shrink-0 shadow-2xl"
        style={{ maxHeight: "100vh" }}
      >
        <MobileSidebar onClose={() => setOpen(false)} />
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={openMenu}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") openMenu();
        }}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border md:hidden touch-manipulation"
        style={{
          borderColor: "var(--border)",
          background: "transparent",
        }}
        aria-label="メニューを開く"
      >
        <span className="flex flex-col gap-0.5" aria-hidden>
          <span
            className="block h-[2px] w-4 rounded-full"
            style={{ background: "var(--fg)" }}
          />
          <span
            className="block h-[2px] w-4 rounded-full"
            style={{ background: "var(--fg)" }}
          />
          <span
            className="block h-[2px] w-4 rounded-full"
            style={{ background: "var(--fg)" }}
          />
        </span>
      </button>

      {mounted && typeof document !== "undefined" && createPortal(overlay, document.body)}
    </>
  );
}

