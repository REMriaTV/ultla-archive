import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractYoutubeVideoId } from "@/lib/youtube";
import { isValidHttpUrl } from "@/lib/external-url";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "ログインが必要です" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (profile?.is_admin !== true) return { error: NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 }) };
  return { error: null };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  if (!supabaseAdmin) return NextResponse.json({ error: "Server error" }, { status: 500 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.description === "string") updates.description = body.description.trim();
  if (Array.isArray(body.keyword_tags)) {
    updates.keyword_tags = body.keyword_tags
      .map((v: unknown) => (typeof v === "string" ? v.trim() : ""))
      .filter((v: string) => v.length > 0);
  }
  if (typeof body.program_id === "number" || typeof body.program_id === "string") {
    const parsed = Number(body.program_id);
    if (Number.isFinite(parsed)) updates.program_id = parsed;
  }
  if (body.visibility === "free" || body.visibility === "invite_only" || body.visibility === "private") {
    updates.visibility = body.visibility;
  }
  if (body.content_tier === "basic" || body.content_tier === "pro" || body.content_tier === "advance") {
    updates.content_tier = body.content_tier;
  }
  if (typeof body.sort_order === "number") updates.sort_order = body.sort_order;
  if (typeof body.is_published === "boolean") {
    updates.is_published = body.is_published;
    if (body.is_published) updates.published_at = new Date().toISOString();
  }
  if (body.youtube_url !== undefined) {
    const nextUrl = typeof body.youtube_url === "string" ? body.youtube_url.trim() : "";
    if (!nextUrl) {
      updates.youtube_url = null;
      updates.youtube_video_id = null;
      if (typeof body.thumbnail_url === "string") {
        updates.thumbnail_url = body.thumbnail_url.trim();
      }
    } else {
      const vid = extractYoutubeVideoId(nextUrl);
      if (!vid) return NextResponse.json({ error: "YouTube の動画URLの形式が不正です" }, { status: 400 });
      updates.youtube_url = nextUrl;
      updates.youtube_video_id = vid;
      if (typeof body.thumbnail_url === "string" && body.thumbnail_url.trim().length > 0) {
        updates.thumbnail_url = body.thumbnail_url.trim();
      } else {
        updates.thumbnail_url = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
      }
    }
  } else if (typeof body.thumbnail_url === "string") {
    updates.thumbnail_url = body.thumbnail_url.trim();
  }
  if (body.external_watch_url !== undefined) {
    const ext = typeof body.external_watch_url === "string" ? body.external_watch_url.trim() : "";
    updates.external_watch_url = ext || null;
    if (ext && !isValidHttpUrl(ext)) {
      return NextResponse.json({ error: "外部視聴URLは http(s) で始まる必要があります" }, { status: 400 });
    }
  }

  const { data: existingRow, error: fetchErr } = await supabaseAdmin.from("videos").select("*").eq("id", id).single();
  if (fetchErr || !existingRow) {
    return NextResponse.json({ error: fetchErr?.message ?? "動画が見つかりません" }, { status: 404 });
  }

  const merged = { ...existingRow, ...updates } as Record<string, unknown>;
  const mergedYoutube = typeof merged.youtube_url === "string" ? merged.youtube_url : "";
  const mergedYtId = extractYoutubeVideoId(mergedYoutube);
  const mergedExt =
    typeof merged.external_watch_url === "string" ? merged.external_watch_url.trim() : "";
  if (!mergedYtId && !isValidHttpUrl(mergedExt)) {
    return NextResponse.json(
      { error: "YouTube の動画URL または 外部視聴URL のどちらかが必要です" },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabaseAdmin.from("videos").update(updates).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (Array.isArray(body.slide_ids)) {
    const slideIds = body.slide_ids.map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n));
    const { error: delError } = await supabaseAdmin.from("video_slides").delete().eq("video_id", id);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });
    if (slideIds.length > 0) {
      const { error: insError } = await supabaseAdmin.from("video_slides").insert(
        slideIds.map((slideId: number, idx: number) => ({ video_id: id, slide_id: slideId, sort_order: idx })),
      );
      if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  if (!supabaseAdmin) return NextResponse.json({ error: "Server error" }, { status: 500 });
  const { id } = await params;

  const { error } = await supabaseAdmin.from("videos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

