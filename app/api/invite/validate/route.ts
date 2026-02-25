import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** 招待コードの有効性を検証（登録前に呼ぶ） */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string"
    ? body.code.trim().toLowerCase().replace(/\s+/g, "-")
    : "";

  if (!code) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ valid: false }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("invite_codes")
    .select("id, max_uses, used_count")
    .eq("code", code)
    .single();

  if (error || !data) {
    return NextResponse.json({ valid: false });
  }

  const remaining = data.max_uses - data.used_count;
  const valid = remaining > 0;

  return NextResponse.json({ valid });
}
