import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canViewVideo, getAccessContext } from "@/lib/access";
import { VideoEpisodeRail } from "@/components/VideoEpisodeRail";
import { extractYoutubeVideoId } from "@/lib/youtube";
import { isValidHttpUrl } from "@/lib/external-url";

interface VideoDetailPageProps {
  params: Promise<{ id: string }>;
}

type VideoRow = {
  id: string | number;
  title: string;
  description?: string | null;
  keyword_tags?: string[] | null;
  youtube_url: string | null;
  youtube_video_id?: string | null;
  external_watch_url?: string | null;
  thumbnail_url?: string | null;
  program_id: string | number;
  visibility?: "free" | "invite_only" | "private" | null;
  content_tier?: "basic" | "pro" | "advance" | null;
  is_published?: boolean | null;
  sort_order?: number | null;
  created_at?: string | null;
};

function getEmbedYoutubeId(video: VideoRow): string | null {
  const fromUrl = video.youtube_url ? extractYoutubeVideoId(video.youtube_url) : null;
  if (fromUrl) return fromUrl;
  return video.youtube_video_id?.trim() || null;
}

function getVideoThumbUrl(video: VideoRow): string | null {
  if (video.thumbnail_url && video.thumbnail_url.trim()) return video.thumbnail_url.trim();
  const ytId = getEmbedYoutubeId(video);
  if (!ytId) return null;
  return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
}

export default async function VideoDetailPage({ params }: VideoDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const accessCtx = await getAccessContext(supabase, supabaseAdmin ?? null);

  const videoClient = (accessCtx.isAdmin || accessCtx.isCoreStaff) && supabaseAdmin ? supabaseAdmin : supabase;
  const { data: video, error } = await videoClient
    .from("videos")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !video) notFound();
  const current = video as VideoRow;
  if (!canViewVideo(current, accessCtx)) notFound();

  const { data: program } = await supabase
    .from("programs")
    .select("id, name, slug")
    .eq("id", current.program_id)
    .maybeSingle();

  const listClient = (accessCtx.isAdmin || accessCtx.isCoreStaff) && supabaseAdmin ? supabaseAdmin : supabase;
  const { data: sameProgramRows } = await listClient
    .from("videos")
    .select("*")
    .eq("program_id", current.program_id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true, nullsFirst: false });

  const visibleSeriesVideos = ((sameProgramRows ?? []) as VideoRow[]).filter((v) => canViewVideo(v, accessCtx));
  const idx = visibleSeriesVideos.findIndex((v) => String(v.id) === String(current.id));
  const prev = idx > 0 ? visibleSeriesVideos[idx - 1] : null;
  const next = idx >= 0 && idx < visibleSeriesVideos.length - 1 ? visibleSeriesVideos[idx + 1] : null;

  const youtubeId = getEmbedYoutubeId(current);
  const externalWatch = current.external_watch_url?.trim() ?? "";
  const hasExternalWatch = isValidHttpUrl(externalWatch);
  if (!youtubeId && !hasExternalWatch) notFound();
  const embedParams = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="mx-auto max-w-4xl px-6 py-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-80" style={{ color: "var(--fg-muted)" }}>
            <span aria-hidden>←</span>
            Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--fg)" }}>
            {current.title}
          </h1>
          {program?.name && (
            <p className="mt-1.5 text-sm" style={{ color: "var(--fg-muted)" }}>
              {program.name}
            </p>
          )}
        </div>

        {youtubeId && (
          <section className="mb-6 overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--card-hover)" }}>
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId}?${embedParams.toString()}`}
                title={current.title}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </section>
        )}

        {!youtubeId && hasExternalWatch && (
          <section className="mb-6 overflow-hidden rounded-lg border px-4 py-10 sm:py-14" style={{ borderColor: "var(--border)", background: "var(--card-hover)" }}>
            <div className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
              <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                このコンテンツは外部サイトで視聴できます（例: 大学の公開講座ページ）。
              </p>
              <a
                href={externalWatch}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--fg)", color: "var(--bg)" }}
              >
                外部サイトで視聴する
              </a>
            </div>
          </section>
        )}

        {youtubeId && hasExternalWatch && (
          <p className="mb-6 text-sm" style={{ color: "var(--fg-muted)" }}>
            <a href={externalWatch} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2 hover:opacity-80" style={{ color: "var(--fg)" }}>
              別サイト（公式ページ）でも視聴できる場合があります
            </a>
          </p>
        )}

        {current.description?.trim() && (
          <p className="mb-5 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
            {current.description.trim()}
          </p>
        )}

        {Array.isArray(current.keyword_tags) && current.keyword_tags.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {current.keyword_tags.map((tag) => (
              <span key={tag} className="rounded-md px-3 py-1.5 text-sm" style={{ background: "var(--card-hover)", color: "var(--fg)" }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {visibleSeriesVideos.length > 1 && (
          <VideoEpisodeRail
            items={visibleSeriesVideos.map((v) => ({
              id: String(v.id),
              title: v.title,
              href: `/video/${v.id}`,
              thumbnailUrl: getVideoThumbUrl(v),
              active: String(v.id) === String(current.id),
            }))}
          />
        )}

        <div className="grid grid-cols-1 gap-3 border-t pt-6 sm:grid-cols-3" style={{ borderColor: "var(--border)" }}>
          <div>
            {prev ? (
              <Link href={`/video/${prev.id}`} className="inline-flex text-sm font-medium hover:opacity-80" style={{ color: "var(--fg-muted)" }}>
                ← 前のエピソード
              </Link>
            ) : (
              <span className="inline-flex text-sm" style={{ color: "var(--fg-muted)", opacity: 0.6 }}>← 前のエピソード</span>
            )}
          </div>
          <div className="text-center">
            <Link href={program?.slug ? `/program/${program.slug}` : "/"} className="inline-flex text-sm font-medium hover:opacity-80" style={{ color: "var(--fg-muted)" }}>
              一覧に戻る
            </Link>
          </div>
          <div className="text-right">
            {next ? (
              <Link href={`/video/${next.id}`} className="inline-flex text-sm font-medium hover:opacity-80" style={{ color: "var(--fg-muted)" }}>
                次のエピソード →
              </Link>
            ) : (
              <span className="inline-flex text-sm" style={{ color: "var(--fg-muted)", opacity: 0.6 }}>次のエピソード →</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

