import Link from "next/link";
import type { Slide } from "@/lib/types";

interface SlideGridProps {
  slides: Slide[];
  isEmpty?: boolean;
}

function SlideCard({ slide }: { slide: Slide }) {
  return (
    <Link href={`/slide/${slide.id}`} className="block">
      <article
        className="overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
        }}
      >
      {(slide.image_url ?? slide.page_image_urls?.[0]) ? (
        <div
          className="aspect-video w-full"
          style={{ background: "var(--card-hover)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.image_url ?? slide.page_image_urls?.[0] ?? ""}
            alt={slide.title}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div
          className="flex aspect-video w-full items-center justify-center"
          style={{ background: "var(--card-hover)", color: "var(--fg-muted)" }}
        >
          <span className="text-sm">画像なし</span>
        </div>
      )}
      <div className="p-4">
        <h3 className="font-medium line-clamp-2" style={{ color: "var(--fg)" }}>
          {slide.title}
        </h3>
        {slide.year && (
          <p className="mt-1 text-sm" style={{ color: "var(--fg-muted)" }}>
            {slide.year}年
          </p>
        )}
        {slide.keyword_tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {slide.keyword_tags.map((tag) => (
              <span
                key={tag}
                className="rounded px-2 py-0.5 text-xs"
              style={{
                background: "var(--card-hover)",
                color: "var(--fg-muted)",
              }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
    </Link>
  );
}

export function SlideGrid({ slides, isEmpty }: SlideGridProps) {
  if (isEmpty) {
    return (
      <div
        className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center"
        style={{
          borderColor: "var(--border)",
          background: "var(--card-hover)",
        }}
      >
        <p style={{ color: "var(--fg-muted)" }}>検索結果がありません</p>
        <p className="mt-1 text-sm" style={{ color: "var(--fg-muted)", opacity: 0.8 }}>
          キーワードやタグでスライドを検索できます
        </p>
      </div>
    );
  }

  if (slides.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {slides.map((slide) => (
        <SlideCard key={slide.id} slide={slide} />
      ))}
    </div>
  );
}
