import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAccessContext, filterVisibleSlides } from "@/lib/access";
import type { Slide } from "@/lib/types";

interface InviteSeriesPageProps {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";

export default async function InviteSeriesPage({ params }: InviteSeriesPageProps) {
  const { code: codeParam } = await params;
  const codeSlug = typeof codeParam === "string" ? codeParam.trim() : "";
  if (!codeSlug) return notFound();

  const supabase = await createClient();
  const accessCtx = await getAccessContext(supabase, supabaseAdmin ?? null);

  if (!supabaseAdmin) return notFound();

  const { data: inviteCode, error: codeError } = await supabaseAdmin
    .from("invite_codes")
    .select("id, name, description")
    .eq("code", codeSlug)
    .single();

  if (codeError || !inviteCode) return notFound();

  if (!accessCtx.userId) return notFound();

  const now = new Date().toISOString();
  const { data: userLink } = await supabase
    .from("user_invite_codes")
    .select("invite_code_id")
    .eq("user_id", accessCtx.userId)
    .eq("invite_code_id", inviteCode.id)
    .gt("expires_at", now)
    .maybeSingle();

  if (!userLink) return notFound();

  const { data: codeSlidesRows } = await supabaseAdmin
    .from("invite_code_slides")
    .select("slide_id")
    .eq("invite_code_id", inviteCode.id);
  const slideIds = [...new Set((codeSlidesRows ?? []).map((r) => String(r.slide_id)))];
  if (slideIds.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <header className="mb-8">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
            シリーズ
          </p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl" style={{ color: "var(--fg)" }}>
            {inviteCode.name ?? codeSlug}
          </h1>
          <p className="mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium" style={{ color: "var(--fg-muted)", background: "var(--card-hover)" }}>
            スライド 0 件
          </p>
        </header>
        <p className="py-12 text-center text-sm" style={{ color: "var(--fg-muted)" }}>
          このシリーズの公開スライドはまだありません。
        </p>
      </main>
    );
  }

  const { data: slidesData, error: slidesError } = await supabaseAdmin
    .from("slides")
    .select("*")
    .in("id", slideIds);

  if (slidesError) {
    console.error("Invite series slides fetch error:", slidesError);
  }

  const rawSlides = (slidesData ?? []) as Slide[];
  const visibleSlides = filterVisibleSlides(rawSlides, accessCtx);
  const sortedSlides = [...visibleSlides].sort((a, b) => {
    const ya = a.year ?? 0;
    const yb = b.year ?? 0;
    return yb - ya;
  });

  const seriesName = inviteCode.name ?? codeSlug;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-8">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
          シリーズ
        </p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl" style={{ color: "var(--fg)" }}>
          {seriesName}
        </h1>
        {inviteCode.description?.trim() && (
          <p className="mt-2 text-sm leading-relaxed md:text-base" style={{ color: "var(--fg-muted)" }}>
            {inviteCode.description.trim()}
          </p>
        )}
        <p className="mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium" style={{ color: "var(--fg-muted)", background: "var(--card-hover)" }}>
          スライド {sortedSlides.length} 件
        </p>
      </header>

      {sortedSlides.length === 0 ? (
        <p className="py-12 text-center text-sm" style={{ color: "var(--fg-muted)" }}>
          このシリーズの公開スライドはまだありません。
        </p>
      ) : (
        <section className="space-y-3 md:space-y-4">
          {sortedSlides.map((slide) => {
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
                <div className="flex min-h-0 flex-1 flex-col justify-start overflow-hidden pt-2 pb-2 pr-3 sm:justify-center sm:gap-1.5 sm:py-5 sm:pr-5">
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
                  <div className="min-h-[1.25em] shrink-0 text-sm sm:min-h-0 sm:text-inherit">
                    <h2
                      className="line-clamp-1 shrink-0 text-sm font-semibold leading-tight sm:line-clamp-2 sm:text-base md:text-lg md:font-bold md:leading-snug"
                      style={{ color: "var(--fg)" }}
                    >
                      {slide.title}
                    </h2>
                  </div>
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
