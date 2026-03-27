import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAccessContext } from "@/lib/access";
import { VideoEpisodeRail } from "@/components/VideoEpisodeRail";

interface VideoDetailPageProps {
  params: Promise<{ id: string }>;
}

type VideoRow = {
  id: string | number;
  title: string;
  description?: string | null;
  keyword_tags?: string[] | null;
  youtube_url: string;
  youtube_video_id?: string | null;
  thumbnail_url?: string | null;
  program_id: string | number;
  visibility?: "free" | "invite_only" | "private" | null;
  content_tier?: "basic" | "pro" | "advance" | null;
  is_published?: boolean | null;
  sort_order?: number | null;
  created_at?: string | null;
};

function canViewVideo(video: VideoRow, ctx: Awaited<ReturnType<typeof getAccessContext>>): boolean {
  if (video.is_published === false && !ctx.isAdmin) return false;
  if (ctx.isAdmin) return true;
  const vis = video.visibility ?? "free";
  if (vis === "private") return false;
  const tier = video.content_tier ?? "basic";
  if (ctx.plan === "advance" || ctx.plan === "premium") return true;
  if (ctx.plan === "pro") {
    return (tier === "basic" || tier === "pro") &&
      (vis !== "invite_only" || (ctx.accessibleSlideIds !== null && ctx.accessibleSlideIds.size > 0));
  }
  if (ctx.plan === "basic") {
    return tier === "basic" && (vis === "free" || (vis === "invite_only" && ctx.accessibleSlideIds !== null && ctx.accessibleSlideIds.size > 0));
  }
  return vis === "free" && tier === "basic";
}

function extractYoutubeId(url: string, fallback?: string | null): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").trim();
      return id || null;
    }
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
    if (m?.[2]) return m[2];
    if (fallback && fallback.trim()) return fallback.trim();
    return null;
  } catch {
    if (fallback && fallback.trim()) return fallback.trim();
    return null;
  }
}

function getVideoThumbUrl(video: VideoRow): string | null {
  if (video.thumbnail_url && video.thumbnail_url.trim()) return video.thumbnail_url.trim();
  const ytId = extractYoutubeId(video.youtube_url, video.youtube_video_id);
  if (!ytId) return null;
  return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
}

export default async function VideoDetailPage({ params }: VideoDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const accessCtx = await getAccessContext(supabase, supabaseAdmin ?? null);

  const videoClient = accessCtx.isAdmin && supabaseAdmin ? supabaseAdmin : supabase;
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

  const listClient = accessCtx.isAdmin && supabaseAdmin ? supabaseAdmin : supabase;
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

  const youtubeId = extractYoutubeId(current.youtube_url, current.youtube_video_id);
  if (!youtubeId) notFound();

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

        <section className="mb-6 overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--card-hover)" }}>
          <div className="aspect-video w-full">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title={current.title}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </section>

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

