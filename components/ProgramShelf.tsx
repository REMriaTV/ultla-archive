"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useExpandedSlide } from "@/components/ExpandedSlideContext";
import type { Program } from "@/lib/types";
import type { Slide } from "@/lib/types";

/** ホバーが使えない環境（タッチデバイス・モバイル）か */
function usePrefersNoHover(): boolean {
  const [value, setValue] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    setValue(mq.matches);
    const listener = () => setValue(mq.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);
  return value;
}

/** プログラム名・slug から種別ラベルとバッジ用クラスを返す */
function getProgramType(program: Program): { label: string; className: string } {
  const s = `${program.name} ${program.slug}`.toLowerCase();
  if (s.includes("abl")) return { label: "ABL", className: "bg-emerald-600 text-white" };
  if (s.includes("pbl")) return { label: "PBL", className: "bg-blue-600 text-white" };
  return { label: "プレゼン", className: "bg-amber-500 text-white" };
}

interface ProgramShelfProps {
  program: Program;
  slides: Slide[];
}

interface SlideThumbProps {
  program: Program;
  slide: Slide;
  expandedSlideId: string | null;
  onExpandSlide: (id: string) => void;
}

function SlideThumb({ program, slide, expandedSlideId, onExpandSlide }: SlideThumbProps) {
  const [isHovered, setIsHovered] = useState(false);
  const prefersNoHover = usePrefersNoHover();
  const programType = getProgramType(program);
  const thumb = slide.image_url ?? slide.page_image_urls?.[0];
  const caption = slide.caption?.trim() || null;
  const captionFallback =
    Array.isArray(slide.keyword_tags) && slide.keyword_tags.length > 0
      ? slide.keyword_tags.slice(0, 2).join(" · ")
      : slide.year
        ? `${slide.year}年`
        : "";
  const captionText = caption ?? captionFallback;

  const expandedByTap = expandedSlideId === slide.id;
  const showPanel = isHovered || expandedByTap;

  const handleLinkClick = (e: React.MouseEvent) => {
    if (prefersNoHover) {
      if (!expandedByTap) {
        e.preventDefault();
        onExpandSlide(slide.id);
      }
    }
  };

  return (
    <div
      className="relative shrink-0 snap-start program-shelf-thumb"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* A: サムネイルスロット（16:9 高さ固定。中身は absolute のため translate してもレイアウト高さは変わらない） */}
      <div className="relative" style={{ paddingBottom: "56.25%" }}>
        <Link
          href={`/slide/${slide.id}`}
          onClick={handleLinkClick}
          className="absolute inset-0 overflow-hidden rounded-xl"
          style={{
            background: "var(--card-hover)",
            transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s ease",
            transform: showPanel ? "translateY(-10px) scale(1.02)" : "translateY(0) scale(1)",
            boxShadow: showPanel
              ? "0 16px 40px rgba(0,0,0,0.18), 0 4px 10px rgba(0,0,0,0.06)"
              : "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          {thumb ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumb}
              alt={slide.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ background: "var(--card-hover)" }}
            >
              <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
                画像なし
              </span>
            </div>
          )}

          {/* ホバー/タップ時グラデーション */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ opacity: showPanel ? 1 : 0, transition: "opacity 0.3s ease" }}
          >
            <div
              className="absolute inset-x-0 top-0"
              style={{
                height: "35%",
                background: "linear-gradient(to bottom, rgba(0,0,0,0.35), transparent)",
              }}
            />
            <div
              className="absolute inset-x-0 bottom-0"
              style={{
                height: "55%",
                background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)",
              }}
            />
          </div>

          {/* ホバー/タップ時タイトル（A内の下端） */}
          <div
            className="absolute inset-x-0 bottom-0 p-3"
            style={{
              opacity: showPanel ? 1 : 0,
              transform: showPanel ? "translateY(0)" : "translateY(8px)",
              transition: "all 0.3s ease 0.05s",
            }}
          >
            <p
              className="line-clamp-2 text-sm font-bold leading-tight text-white"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}
            >
              {slide.title}
            </p>
          </div>
        </Link>
      </div>

      {/* B: 情報帯（ホバーまたはモバイルでタップ時に開く） */}
      <div
        className="relative z-10 overflow-hidden rounded-b-xl"
        style={{
          background: "var(--card)",
          marginTop: -10,
          maxHeight: showPanel ? 110 : 0,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: showPanel ? 10 : 0,
          paddingBottom: showPanel ? 12 : 0,
          opacity: showPanel ? 1 : 0,
          transition: "all 0.3s cubic-bezier(0.22,1,0.36,1)",
          boxShadow: showPanel ? "0 8px 20px rgba(0,0,0,0.1)" : "none",
        }}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${programType.className}`}
          >
            {programType.label}
          </span>
          {slide.year != null && (
            <span className="text-[11px] font-medium" style={{ color: "var(--fg-muted)" }}>
              {slide.year}年
            </span>
          )}
        </div>
        {captionText && (
          <p
            className="line-clamp-2 text-[11.5px] leading-relaxed"
            style={{ color: "var(--fg-muted)" }}
          >
            {captionText}
          </p>
        )}
      </div>
    </div>
  );
}

interface InviteSeriesShelfProps {
  id: string;
  codeName: string;
  codeSlug: string;
  slides: Slide[];
  programs: Program[];
}

interface MylistShelfProps {
  slides: Slide[];
  programs: Program[];
  className?: string;
}

/** マイリスト棚（トップのシリーズ一覧に表示。すべて表示で /mypage/mylist へ） */
export function MylistShelf({ slides, programs, className = "" }: MylistShelfProps) {
  const globalExpanded = useExpandedSlide();
  const [localExpandedId, setLocalExpandedId] = useState<string | null>(null);
  const expandedSlideId = globalExpanded?.expandedSlideId ?? localExpandedId;
  const setExpandedSlideId = globalExpanded?.setExpandedSlideId ?? setLocalExpandedId;
  const programMap = new Map(programs.map((p) => [p.id, p]));
  const fallbackProgram: Program = {
    id: "",
    slug: "",
    name: "その他",
    description: null,
    started_year: null,
  };

  if (slides.length === 0) return null;

  return (
    <section id="mylist-series" className={`scroll-mt-24 ${className}`.trim()}>
      <div className="mb-1 flex items-baseline justify-between gap-3 md:mb-3">
        <div className="min-w-0 flex-1">
          <h2
            className="mb-1 text-lg font-semibold md:text-xl"
            style={{ color: "var(--fg)" }}
          >
            マイリスト
          </h2>
        </div>
        <Link
          href="/mypage/mylist"
          className="shrink-0 text-[11px] font-medium tracking-wide hover:opacity-80 md:text-xs"
          style={{ color: "var(--fg-muted)" }}
        >
          すべて表示 &gt;
        </Link>
      </div>
      <div style={{ overflow: "visible" }}>
        <div
          className="scrollbar-hide flex items-start gap-4 px-1 snap-x snap-mandatory"
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            paddingBottom: 0,
            minHeight: 120,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {slides.map((slide) => (
            <SlideThumb
              key={slide.id}
              program={programMap.get(slide.program_id) ?? fallbackProgram}
              slide={slide}
              expandedSlideId={expandedSlideId}
              onExpandSlide={setExpandedSlideId}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** 招待コード1つを1シリーズとして一括表示（ジャンル混ぜ。すべて表示で専用ページへ） */
export function InviteSeriesShelf({ id, codeName, codeSlug, slides, programs }: InviteSeriesShelfProps) {
  const globalExpanded = useExpandedSlide();
  const [localExpandedId, setLocalExpandedId] = useState<string | null>(null);
  const expandedSlideId = globalExpanded?.expandedSlideId ?? localExpandedId;
  const setExpandedSlideId = globalExpanded?.setExpandedSlideId ?? setLocalExpandedId;
  const programMap = new Map(programs.map((p) => [p.id, p]));
  const fallbackProgram: Program = {
    id: "",
    slug: "",
    name: "その他",
    description: null,
    started_year: null,
  };

  if (slides.length === 0) return null;

  return (
    <section id={`invite-code-${id}`} className="mb-8 scroll-mt-24 md:mb-10">
      <div className="mb-1 flex items-baseline justify-between gap-3 md:mb-3">
        <div className="min-w-0 flex-1">
          <h2
            className="mb-1 text-lg font-semibold md:text-xl"
            style={{ color: "var(--fg)" }}
          >
            {codeName}
          </h2>
        </div>
        <Link
          href={`/invite-series/${encodeURIComponent(codeSlug)}`}
          className="shrink-0 text-[11px] font-medium tracking-wide hover:opacity-80 md:text-xs"
          style={{ color: "var(--fg-muted)" }}
        >
          すべて表示 &gt;
        </Link>
      </div>
      <div style={{ overflow: "visible" }}>
        <div
          className="scrollbar-hide flex items-start gap-4 px-1 snap-x snap-mandatory"
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            paddingBottom: 0,
            minHeight: 120,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {slides.map((slide) => (
            <SlideThumb
              key={slide.id}
              program={programMap.get(slide.program_id) ?? fallbackProgram}
              slide={slide}
              expandedSlideId={expandedSlideId}
              onExpandSlide={setExpandedSlideId}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** シリーズ間の余白: モバイル 12px / デスクトップ（md以上）24px。微調整時は mb-3（12px）, mb-4（16px）, mb-6（24px）を変更 */
export function ProgramShelf({ program, slides }: ProgramShelfProps) {
  const globalExpanded = useExpandedSlide();
  const [localExpandedId, setLocalExpandedId] = useState<string | null>(null);
  const expandedSlideId = globalExpanded?.expandedSlideId ?? localExpandedId;
  const setExpandedSlideId = globalExpanded?.setExpandedSlideId ?? setLocalExpandedId;

  if (slides.length === 0) return null;

  return (
    <section className="mb-0 md:mb-6">
      <div className="mb-1 flex items-baseline justify-between gap-3 md:mb-3">
        <div className="min-w-0 flex-1">
          <h2
            className="mb-1 text-lg font-semibold md:text-xl"
            style={{ color: "var(--fg)" }}
          >
            {program.name}
          </h2>
          {program.description?.trim() && (
            <p
              className="line-clamp-1 text-sm md:text-xs"
              style={{ color: "var(--fg-muted)" }}
            >
              {program.description.trim()}
            </p>
          )}
        </div>
        <Link
          href={`/program/${program.slug || program.id}`}
          className="shrink-0 text-[11px] font-medium tracking-wide hover:opacity-80 md:text-xs"
          style={{ color: "var(--fg-muted)" }}
        >
          すべて表示 &gt;
        </Link>
      </div>
      {/* 棚の高さをサムネイルに合わせ、縦スクロールバーを出さない（Safari で min-content が効かないため具体的な最小高さを指定） */}
      <div style={{ overflow: "visible" }}>
        <div
          className="scrollbar-hide flex items-start gap-4 px-1 snap-x snap-mandatory"
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            paddingBottom: 0,
            /* 16:9 の最大カード幅 210px 相当の高さ以上を確保 */
            minHeight: 120,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {slides.map((slide) => (
            <SlideThumb
              key={slide.id}
              program={program}
              slide={slide}
              expandedSlideId={expandedSlideId}
              onExpandSlide={setExpandedSlideId}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
