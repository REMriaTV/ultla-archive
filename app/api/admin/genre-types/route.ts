import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** ジャンル種別一覧（管理画面用） */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("genre_types")
    .select("id, name, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

/** ジャンル種別を新規追加（管理者のみ） */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim().toLowerCase().replace(/\s+/g, "-") : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const sort_order = typeof body.sort_order === "number" ? body.sort_order : 0;

  if (!id || !name) {
    return NextResponse.json(
      { error: "id と name は必須です。id は英数字・ハイフンのみ（例: event）" },
      { status: 400 }
    );
  }

  if (!/^[a-z0-9-]+$/.test(id)) {
    return NextResponse.json(
      { error: "id は英小文字・数字・ハイフンのみ使用できます" },
      { status: 400 }
    );
  }

  const { data: inserted, error } = await supabase
    .from("genre_types")
    .insert({ id, name, sort_order, updated_at: new Date().toISOString() })
    .select("id, name, sort_order")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "この id は既に使われています" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(inserted);
}
