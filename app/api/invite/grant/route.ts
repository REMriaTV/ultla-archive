import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DEFAULT_EXPIRY_MONTHS = 1;

/** 招待コードでアクセス付与（登録直後に呼ぶ） */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toLowerCase().replace(/\s+/g, "-") : "";

  if (!code) {
    return NextResponse.json({ error: "招待コードを入力してください" }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { data: invite, error: fetchError } = await supabaseAdmin
    .from("invite_codes")
    .select("id, max_uses, used_count")
    .eq("code", code)
    .single();

  if (fetchError || !invite) {
    return NextResponse.json({ error: "無効な招待コードです" }, { status: 400 });
  }

  const remaining = invite.max_uses - invite.used_count;
  if (remaining <= 0) {
    return NextResponse.json({ error: "この招待コードは使用上限に達しています" }, { status: 400 });
  }

  // 既にこのユーザーがこのコードを持っているか確認
  const { data: existing } = await supabaseAdmin
    .from("user_invite_codes")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("invite_code_id", invite.id)
    .single();

  if (existing) {
    return NextResponse.json({ success: true, message: "既に登録済みです" });
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + DEFAULT_EXPIRY_MONTHS);

  // user_invite_codes に追加
  const { error: insertError } = await supabaseAdmin
    .from("user_invite_codes")
    .insert({
      user_id: user.id,
      invite_code_id: invite.id,
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 });
  }

  // used_count をインクリメント（後方互換）
  await supabaseAdmin
    .from("invite_codes")
    .update({ used_count: invite.used_count + 1 })
    .eq("id", invite.id);

  // レガシー: access_granted も付与（移行期間の互換性）
  await supabaseAdmin
    .from("profiles")
    .update({ access_granted: true, updated_at: now.toISOString() })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
