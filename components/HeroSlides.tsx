"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import type { Slide } from "@/lib/types";

const SLIDE_DURATION = 5500;
const TRANSITION_MS = 600;
const MOBILE_BREAKPOINT = 768;

export type HeroCarouselItem =
  | { kind: "slide"; slide: Slide }
  | {
      kind: "video";
      id: string;
      title: string;
      thumbnailUrl: string | null;
      href: string;
      openInNewTab: boolean;
    };

interface HeroSlidesProps {
  items: HeroCarouselItem[];
  intervalMs?: number;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export function HeroSlides({ items, intervalMs = SLIDE_DURATION }: HeroSlidesProps) {
  const isMobile = useIsMobile();
  const [index, setIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const total = items.length;

  const extended = total > 0 ? [...items, ...items, ...items] : [];
  const offset = total;
  const slideWidthPercent = total > 0 ? (isMobile ? 100 : 100 / 3) : 0;

  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => prev + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [total, intervalMs]);

  useEffect(() => {
    if (total <= 1) return;
    if (index >= total) {
      const timeout = setTimeout(() => {
        setIsTransitioning(false);
        setIndex(0);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsTransitioning(true);
          });
        });
      }, TRANSITION_MS);
      return () => clearTimeout(timeout);
    }
  }, [index, total]);

  const goPrev = () => {
    if (total <= 1) return;
    setIsTransitioning(true);
    setIndex((prev) => (prev - 1 + total) % total);
  };

  const goNext = () => {
    if (total <= 1) return;
    setIsTransitioning(true);
    setIndex((prev) => (prev + 1) % total);
  };

  if (total === 0) return null;

  const translateX = -((offset + index) * slideWidthPercent);

  const navButtonClass =
    "flex h-12 w-12 shrink-0 items-center justify-center transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent";
  const navButtonStyle = { color: "var(--fg)" };

  function renderCard(item: HeroCarouselItem, i: number) {
    const isCenter = isMobile ? i === offset + index : i === offset + index + 1;
    const inner = (
      <div
        className={`h-full w-full overflow-hidden ${isMobile ? "rounded-none" : "rounded-lg"}`}
        style={{
          transform: isCenter ? "scale(1)" : "scale(0.9)",
          opacity: isCenter ? 1 : 0.8,
          transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.33, 0, 0.2, 1)`,
        }}
      >
        {item.kind === "slide" ? (
          (() => {
            const slide = item.slide;
            const thumb = slide.image_url ?? slide.page_image_urls?.[0];
            return thumb ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={thumb}
                alt={slide.title}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ background: "var(--card-hover)", color: "var(--fg-muted)" }}
              >
                <span className="text-sm">画像なし</span>
              </div>
            );
          })()
        ) : item.thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-1"
            style={{ background: "var(--card-hover)", color: "var(--fg-muted)" }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/90">Video</span>
            <span className="line-clamp-2 px-2 text-center text-sm">{item.title}</span>
          </div>
        )}
      </div>
    );

    const wrapClass = `flex shrink-0 items-center justify-center overflow-hidden ${isMobile ? "px-0" : "px-1"}`;

    if (item.kind === "slide") {
      return (
        <Link
          key={`slide-${item.slide.id}-${i}`}
          href={`/slide/${item.slide.id}`}
          className={wrapClass}
          style={{ width: `${slideWidthPercent}%` }}
        >
          {inner}
        </Link>
      );
    }

    if (item.openInNewTab) {
      return (
        <a
          key={`video-${item.id}-${i}`}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={wrapClass}
          style={{ width: `${slideWidthPercent}%` }}
        >
          {inner}
        </a>
      );
    }

    return (
      <Link key={`video-${item.id}-${i}`} href={item.href} className={wrapClass} style={{ width: `${slideWidthPercent}%` }}>
        {inner}
      </Link>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-none px-3 md:rounded-xl md:px-0"
      aria-label="おすすめコンテンツ"
    >
      <div className="relative h-[min(50vh,320px)] w-full overflow-hidden sm:h-[min(50vh,360px)] md:h-[min(50vh,360px)]">
        <div
          className="flex h-full items-center"
          style={{
            transform: `translate3d(${translateX}%, 0, 0)`,
            transition: isTransitioning
              ? `transform ${TRANSITION_MS}ms cubic-bezier(0.33, 0, 0.2, 1)`
              : "none",
            willChange: "transform",
          }}
        >
          {extended.map((item, i) => renderCard(item, i))}
        </div>
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className={`absolute left-2 top-1/2 z-10 -translate-y-1/2 md:left-3 ${navButtonClass}`}
            style={navButtonStyle}
            aria-label="前へ"
          >
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            className={`absolute right-2 top-1/2 z-10 -translate-y-1/2 md:right-3 ${navButtonClass}`}
            style={navButtonStyle}
            aria-label="次へ"
          >
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {total > 1 && (
        <div className="absolute bottom-1 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setIsTransitioning(true);
                setIndex(i);
              }}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index % total ? 24 : 6,
                background: i === index % total ? "var(--fg)" : "var(--fg-muted)",
              }}
              aria-label={`${i + 1} 枚目を表示`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
