import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** ログイン中のユーザーが登録している招待コード一覧（表示名・有効期限） */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { data: userCodes } = await supabase
    .from("user_invite_codes")
    .select("invite_code_id, expires_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!userCodes?.length) {
    return NextResponse.json({ items: [] });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ items: [] });
  }

  const codeIds = userCodes.map((r) => r.invite_code_id);
  const { data: codes } = await supabaseAdmin
    .from("invite_codes")
    .select("id, name, code")
    .in("id", codeIds);

  const byId = new Map((codes ?? []).map((c) => [c.id, c]));
  const items = userCodes
    .filter((u) => byId.has(u.invite_code_id))
    .map((u) => {
      const inv = byId.get(u.invite_code_id)!;
      return {
        invite_code_id: u.invite_code_id,
        name: inv.name ?? inv.code,
        code: inv.code,
        expires_at: u.expires_at,
        created_at: u.created_at,
      };
    });

  return NextResponse.json({ items });
}
