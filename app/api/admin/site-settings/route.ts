import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** サイト設定取得（管理画面用・認証必須） */
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

  const client = supabaseAdmin ?? supabase;
  const { data, error } = await client
    .from("site_settings")
    .select("subtitle, footer_text, updated_at")
    .eq("id", "main")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    subtitle: data?.subtitle ?? "",
    footer_text: data?.footer_text ?? "",
    updated_at: data?.updated_at ?? null,
  });
}

/** サイト設定更新（管理者のみ） */
export async function PATCH(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const subtitle = typeof body.subtitle === "string" ? body.subtitle.trim() : undefined;
  const footer_text = typeof body.footer_text === "string" ? body.footer_text.trim() : undefined;

  const updates: { subtitle?: string; footer_text?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (subtitle !== undefined) updates.subtitle = subtitle;
  if (footer_text !== undefined) updates.footer_text = footer_text;

  const { data, error } = await supabase
    .from("site_settings")
    .update(updates)
    .eq("id", "main")
    .select("subtitle, footer_text, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
