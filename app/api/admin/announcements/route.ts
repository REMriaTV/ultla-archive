import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** お知らせ一覧取得（管理者のみ。全件） */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (profile?.is_admin !== true) {
    return NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("announcements")
    .select("id, title, body, is_published, created_at, updated_at, published_at, show_on_home, home_sort_order")
    .order("published_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

/** お知らせ新規作成（管理者のみ） */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (profile?.is_admin !== true) {
    return NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const bodyText = typeof body.body === "string" ? body.body.trim() : "";
  const isPublished = body.is_published === true;
  const showOnHome = body.show_on_home === true;
  const homeSortOrder =
    typeof body.home_sort_order === "number" && Number.isFinite(body.home_sort_order)
      ? Math.floor(body.home_sort_order)
      : 0;

  if (!title || !bodyText) {
    return NextResponse.json({ error: "タイトルと本文は必須です" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const row = {
    title,
    body: bodyText,
    is_published: isPublished,
    published_at: isPublished ? now : body.published_at ?? now,
    updated_at: now,
    show_on_home: showOnHome,
    home_sort_order: homeSortOrder,
  };

  const { data, error } = await supabaseAdmin
    .from("announcements")
    .insert(row)
    .select("id, title, body, is_published, created_at, updated_at, published_at, show_on_home, home_sort_order")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
