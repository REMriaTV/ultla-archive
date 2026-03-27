import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function extractYoutubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace("/", "").slice(0, 11) || null;
    }
    if (u.hostname.includes("youtube.com")) {
      const fromQuery = u.searchParams.get("v");
      if (fromQuery) return fromQuery.slice(0, 11);
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.findIndex((p) => p === "embed" || p === "shorts");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1].slice(0, 11);
    }
    return null;
  } catch {
    return null;
  }
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "ログインが必要です" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (profile?.is_admin !== true) {
    return { error: NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 }) };
  }
  return { error: null };
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  if (!supabaseAdmin) return NextResponse.json({ error: "Server error" }, { status: 500 });

  const { data: videos, error } = await supabaseAdmin
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (videos ?? []).map((v) => v.id);
  let links: Array<{ video_id: string; slide_id: number; sort_order: number }> = [];
  if (ids.length > 0) {
    const res = await supabaseAdmin
      .from("video_slides")
      .select("video_id, slide_id, sort_order")
      .in("video_id", ids)
      .order("sort_order", { ascending: true });
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    links = (res.data ?? []) as Array<{ video_id: string; slide_id: number; sort_order: number }>;
  }

  const byVideo = new Map<string, number[]>();
  for (const link of links) {
    const arr = byVideo.get(link.video_id) ?? [];
    arr.push(link.slide_id);
    byVideo.set(link.video_id, arr);
  }

  return NextResponse.json((videos ?? []).map((v) => ({ ...v, slide_ids: byVideo.get(v.id) ?? [] })));
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  if (!supabaseAdmin) return NextResponse.json({ error: "Server error" }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const youtubeUrl = typeof body.youtube_url === "string" ? body.youtube_url.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : null;
  const keywordTags = Array.isArray(body.keyword_tags)
    ? body.keyword_tags
        .map((v: unknown) => (typeof v === "string" ? v.trim() : ""))
        .filter((v: string) => v.length > 0)
    : [];
  const programId = typeof body.program_id === "number" ? body.program_id : Number(body.program_id);
  const visibility = body.visibility === "invite_only" || body.visibility === "private" ? body.visibility : "free";
  const contentTier = body.content_tier === "pro" || body.content_tier === "advance" ? body.content_tier : "basic";
  const sortOrder = typeof body.sort_order === "number" ? body.sort_order : Number(body.sort_order) || 0;
  const isPublished = body.is_published !== false;
  const slideIds = Array.isArray(body.slide_ids) ? body.slide_ids.map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n)) : [];

  if (!title || !youtubeUrl || !Number.isFinite(programId)) {
    return NextResponse.json({ error: "タイトル / 動画URL / シリーズは必須です" }, { status: 400 });
  }

  const videoId = extractYoutubeVideoId(youtubeUrl);
  if (!videoId) {
    return NextResponse.json({ error: "動画URL の形式が不正です" }, { status: 400 });
  }

  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const now = new Date().toISOString();
  const { data: created, error: createError } = await supabaseAdmin
    .from("videos")
    .insert({
      title,
      youtube_url: youtubeUrl,
      youtube_video_id: videoId,
      thumbnail_url: thumbnail,
      description,
      keyword_tags: keywordTags,
      program_id: programId,
      visibility,
      content_tier: contentTier,
      sort_order: sortOrder,
      is_published: isPublished,
      published_at: isPublished ? now : null,
      updated_at: now,
    })
    .select("id")
    .single();
  if (createError || !created) {
    return NextResponse.json({ error: createError?.message ?? "作成に失敗しました" }, { status: 500 });
  }

  if (slideIds.length > 0) {
    const { error: linkError } = await supabaseAdmin.from("video_slides").insert(
      slideIds.map((slideId: number, idx: number) => ({
        video_id: created.id,
        slide_id: slideId,
        sort_order: idx,
      })),
    );
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: created.id });
}

