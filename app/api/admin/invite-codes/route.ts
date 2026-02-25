import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** 招待コード一覧取得（認証必須） */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { data: codes, error: codesError } = await supabaseAdmin
    .from("invite_codes")
    .select("id, code, name, description, max_uses, used_count, created_at")
    .order("created_at", { ascending: false });

  if (codesError) {
    return NextResponse.json({ error: codesError.message }, { status: 500 });
  }

  const { data: links } = await supabaseAdmin
    .from("invite_code_slides")
    .select("invite_code_id, slide_id");

  const slideIdsByCode = new Map<string, string[]>();
  for (const link of links ?? []) {
    const arr = slideIdsByCode.get(link.invite_code_id) ?? [];
    arr.push(link.slide_id);
    slideIdsByCode.set(link.invite_code_id, arr);
  }

  const result = (codes ?? []).map((c) => ({
    ...c,
    slide_ids: slideIdsByCode.get(c.id) ?? [],
  }));

  return NextResponse.json(result);
}

/** 招待コード新規作成（認証必須） */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toLowerCase().replace(/\s+/g, "-") : "";
  const name = typeof body.name === "string" ? body.name.trim() : null;
  const description = typeof body.description === "string" ? body.description.trim() : null;
  const slideIds = Array.isArray(body.slide_ids)
    ? body.slide_ids
        .map((s: unknown) => (typeof s === "number" ? s : typeof s === "string" ? parseInt(s, 10) : NaN))
        .filter((n: number): n is number => !isNaN(n))
    : [];

  if (!code) {
    return NextResponse.json({ error: "code は必須です" }, { status: 400 });
  }

  const { data: created, error: insertError } = await supabaseAdmin
    .from("invite_codes")
    .insert({
      code,
      name: name || null,
      description: description || null,
      max_uses: body.max_uses ?? 100,
      used_count: 0,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "このコードは既に存在します" }, { status: 400 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (slideIds.length > 0 && created?.id) {
    const { error } = await supabaseAdmin.from("invite_code_slides").insert(
      slideIds.map((slide_id: number) => ({ invite_code_id: created.id, slide_id }))
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: created?.id });
}
