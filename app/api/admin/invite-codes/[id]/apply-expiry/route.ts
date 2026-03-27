import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** この招待コードの既定有効期限を、既に登録済みの全ユーザーに一括適用する */
export async function POST(
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

  const { data: invite, error: fetchError } = await supabaseAdmin
    .from("invite_codes")
    .select("id, default_expires_at")
    .eq("id", id)
    .single();

  if (fetchError || !invite) {
    return NextResponse.json({ error: "招待コードが見つかりません" }, { status: 404 });
  }

  if (!invite.default_expires_at) {
    return NextResponse.json(
      { error: "この招待コードに既定の有効期限が設定されていません。編集で有効期限を設定してから実行してください。" },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("user_invite_codes")
    .update({ expires_at: invite.default_expires_at })
    .eq("invite_code_id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "既存の登録ユーザー全員の有効期限を適用しました",
  });
}
