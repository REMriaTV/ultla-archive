import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** 招待コード更新（認証必須） */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (profile?.is_admin !== true) {
    return NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim() || null;
  if (typeof body.description === "string") updates.description = body.description.trim() || null;
  if (typeof body.max_uses === "number") updates.max_uses = body.max_uses;
  if (body.default_expires_at === null || body.default_expires_at === "") {
    updates.default_expires_at = null;
  } else if (typeof body.default_expires_at === "string" && body.default_expires_at.trim()) {
    updates.default_expires_at = body.default_expires_at.trim();
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin
      .from("invite_codes")
      .update(updates)
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(body.slide_ids)) {
    // slide_id は DB で bigint のため、数値・文字列両方を受け付ける（Supabase は bigint を number で返す）
    const slideIds = body.slide_ids
      .map((s: unknown) => (typeof s === "number" ? s : typeof s === "string" ? parseInt(s, 10) : NaN))
      .filter((n: number): n is number => !isNaN(n));
    await supabaseAdmin.from("invite_code_slides").delete().eq("invite_code_id", id);
    if (slideIds.length > 0) {
      const { error } = await supabaseAdmin.from("invite_code_slides").insert(
        slideIds.map((slide_id: number) => ({ invite_code_id: id, slide_id }))
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (Array.isArray(body.video_ids)) {
    const videoIds = body.video_ids
      .map((v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN))
      .filter((n: number): n is number => !isNaN(n));
    await supabaseAdmin.from("invite_code_videos").delete().eq("invite_code_id", id);
    if (videoIds.length > 0) {
      const { error } = await supabaseAdmin.from("invite_code_videos").insert(
        videoIds.map((video_id: number) => ({ invite_code_id: id, video_id }))
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

/** 招待コード削除（認証必須） */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (profile?.is_admin !== true) {
    return NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { error } = await supabaseAdmin.from("invite_codes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
