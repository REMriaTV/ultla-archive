"use client";

import Link from "next/link";
import { useRef } from "react";

type EpisodeItem = {
  id: string;
  title: string;
  href: string;
  thumbnailUrl: string | null;
  active: boolean;
};

export function VideoEpisodeRail({ items }: { items: EpisodeItem[] }) {
  const railRef = useRef<HTMLDivElement | null>(null);

  const scrollByAmount = (direction: "prev" | "next") => {
    const rail = railRef.current;
    if (!rail) return;
    const amount = Math.max(rail.clientWidth * 0.8, 220);
    rail.scrollBy({
      left: direction === "next" ? amount : -amount,
      behavior: "smooth",
    });
  };

  return (
    <section className="mb-8 border-t pt-6" style={{ borderColor: "var(--border)" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
          同じシリーズのエピソード
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByAmount("prev")}
            className="rounded-md border px-2.5 py-1 text-xs font-medium hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--fg-muted)", background: "var(--card)" }}
            aria-label="前へスクロール"
          >
            ← 前へ
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount("next")}
            className="rounded-md border px-2.5 py-1 text-xs font-medium hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--fg-muted)", background: "var(--card)" }}
            aria-label="次へスクロール"
          >
            次へ →
          </button>
        </div>
      </div>

      <div ref={railRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
        {items.map((v) => (
          <Link
            key={v.id}
            href={v.href}
            className="w-52 shrink-0 snap-start overflow-hidden rounded-lg border"
            style={{
              borderColor: v.active ? "var(--fg)" : "var(--border)",
              background: "var(--card)",
              boxShadow: v.active ? "0 0 0 1px var(--fg) inset" : "none",
            }}
          >
            <div className="relative" style={{ paddingBottom: "56.25%" }}>
              {v.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbnailUrl} alt={v.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: "var(--fg-muted)", background: "var(--card-hover)" }}>
                  サムネイルなし
                </div>
              )}
            </div>
            <div className="px-2.5 py-2">
              <p className="line-clamp-2 text-xs font-medium leading-snug" style={{ color: v.active ? "var(--fg)" : "var(--fg-muted)" }}>
                {v.title}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

