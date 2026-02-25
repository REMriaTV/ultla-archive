import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAccessContext, filterVisibleSlides } from "@/lib/access";
import type { Slide } from "@/lib/types";

interface ProgramPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProgramPage({ params }: ProgramPageProps) {
  const { slug: slugParam } = await params;
  const supabase = await createClient();
  const slugOrId = typeof slugParam === "string" ? slugParam : "";

  const isId = UUID_REGEX.test(slugOrId);
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("*")
    .match(isId ? { id: slugOrId } : { slug: slugOrId })
    .single();

  if (programError || !program) {
    return notFound();
  }

  const accessCtx = await getAccessContext(supabase, supabaseAdmin ?? null);

  const { data: slidesData, error: slidesError } = await supabase
    .from("slides")
    .select("*")
    .eq("program_id", program.id)
    .order("year", { ascending: false, nullsFirst: false });

  if (slidesError) {
    console.error("Program page slides fetch error:", slidesError);
  }

  const visibleSlides = filterVisibleSlides((slidesData ?? []) as Slide[], accessCtx);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-8">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
          シリーズ
        </p>
        <h1
          className="text-2xl font-bold tracking-tight md:text-3xl"
          style={{ color: "var(--fg)" }}
        >
          {program.name}
        </h1>
        {program.description && (
          <p
            className="mt-2 text-sm leading-relaxed md:text-base"
            style={{ color: "var(--fg-muted)" }}
          >
            {program.description}
          </p>
        )}
        <p className="mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium" style={{ color: "var(--fg-muted)", background: "var(--card-hover)" }}>
          スライド {visibleSlides.length} 件
        </p>
      </header>

      {visibleSlides.length === 0 ? (
        <p className="py-12 text-center text-sm" style={{ color: "var(--fg-muted)" }}>
          このシリーズの公開スライドはまだありません。
        </p>
      ) : (
        <section className="space-y-3 md:space-y-4">
          {visibleSlides.map((slide) => {
            const thumb = slide.image_url ?? slide.page_image_urls?.[0];
            const caption = slide.caption?.trim() || null;
            const captionFallback =
              Array.isArray(slide.keyword_tags) && slide.keyword_tags.length > 0
                ? slide.keyword_tags.slice(0, 2).join(" · ")
                : slide.year
                  ? `${slide.year}年`
                  : "";
            const captionText = caption ?? captionFallback;
            const tags = Array.isArray(slide.keyword_tags) ? slide.keyword_tags.slice(0, 4) : [];

            return (
              <Link
                key={slide.id}
                href={`/slide/${slide.id}`}
                className="flex min-h-[90px] gap-4 overflow-hidden rounded-lg border transition-[box-shadow,transform] duration-300 ease-out hover:scale-[1.01] hover:shadow-[0_12px_40px_rgba(0,0,0,0.22),0_0_0_2px_rgba(255,255,255,0.25),0_0_40px_rgba(255,255,255,0.15)] active:scale-[0.99] sm:min-h-0 sm:gap-5"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--card)",
                }}
              >
                {/* サムネイル：左・16:9。カード高さ＝サムネイルに合わせる（モバイル） */}
                <div className="relative flex w-40 shrink-0 items-stretch overflow-hidden sm:w-48 md:w-56">
                  <div className="relative w-full overflow-hidden" style={{ paddingBottom: "56.25%" }}>
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt={slide.title}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: "var(--card-hover)" }}
                      >
                        <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
                          画像なし
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {/* テキスト：右。▼タイトル/キャプションの開始位置：pt-3 を pt-2/pt-4/pt-5 等に変更で上下可（モバイル） */}
                <div className="flex min-h-0 flex-1 flex-col justify-start overflow-hidden pt-2 pb-2 pr-3 sm:justify-center sm:gap-1.5 sm:py-5 sm:pr-5">
                  {/* 年・タグ行：モバイルでは非表示（年は省略）、sm 以上で表示 */}
                  <div className="hidden min-h-0 shrink-0 items-start justify-end gap-2 pb-0.5 sm:flex sm:justify-between sm:pb-0">
                    {slide.year != null ? (
                      <span className="text-[10px] font-medium leading-none shrink-0 sm:text-xs" style={{ color: "var(--fg-muted)" }}>
                        {slide.year}年
                      </span>
                    ) : (
                      <span className="shrink-0" />
                    )}
                    {tags.length > 0 && (
                      <div className="hidden flex-nowrap justify-end gap-1 overflow-hidden sm:flex">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ color: "var(--fg-muted)", background: "var(--card-hover)" }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* タイトル（モバイル1行・省略表示）。▼フォントサイズ：下の2箇所を揃えて変更（text-xs=12px / text-[13px] / text-sm=14px） */}
                  <div className="min-h-[1.25em] shrink-0 text-sm sm:min-h-0 sm:text-inherit">
                    <h2
                      className="line-clamp-1 shrink-0 text-sm font-semibold leading-tight sm:line-clamp-2 sm:text-base md:text-lg md:font-bold md:leading-snug"
                      style={{ color: "var(--fg)" }}
                    >
                      {slide.title}
                    </h2>
                  </div>
                  {/* キャプション：モバイルは2行分・emを9pxに合わせて余白を出さない */}
                  <div className="min-h-[2.6em] shrink-0 text-[9px] sm:min-h-0 sm:text-inherit">
                    {captionText ? (
                      <p
                        className="line-clamp-2 mt-0.5 text-[9px] leading-tight sm:mt-0 sm:line-clamp-2 sm:text-sm sm:leading-relaxed"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        {captionText}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[9px] leading-tight sm:mt-0 sm:text-sm" aria-hidden>&nbsp;</p>
                    )}
                  </div>
                  {/* モバイル：スペーサーでタグをカード下部に固定。▼キャプションとタグの間隔：次の div の mt-1 を変更（mt-0=なし / mt-0.5 / mt-1 / mt-2 で広がる） */}
                  <div className="min-h-0 flex-1 sm:hidden" aria-hidden />
                  {tags.length > 0 && (
                    <div className="mt-0 flex shrink-0 items-center gap-1 overflow-hidden sm:mt-0 sm:hidden">
                      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden">
                        {tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium"
                            style={{ color: "var(--fg-muted)", background: "var(--card-hover)" }}
                          >
                            {tag}
                          </span>
                        ))}
                        {tags.length > 3 && (
                          <span
                            className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium"
                            style={{ color: "var(--fg-muted)", background: "var(--card-hover)" }}
                          >
                            ...
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}

