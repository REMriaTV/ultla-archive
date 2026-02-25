import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** ジャンル種別を更新（管理者のみ） */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { id: routeId } = await params;
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const sort_order = typeof body.sort_order === "number" ? body.sort_order : undefined;

  if (name === undefined && sort_order === undefined) {
    return NextResponse.json({ error: "name または sort_order を指定してください" }, { status: 400 });
  }

  const updates: { name?: string; sort_order?: number; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  if (name !== undefined) updates.name = name;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  const { data, error } = await supabase
    .from("genre_types")
    .update(updates)
    .eq("id", routeId)
    .select("id, name, sort_order")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

/** ジャンル種別を削除（管理者のみ。使用中の場合はエラー） */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { id: genreId } = await params;

  const { data: programs } = await supabase
    .from("programs")
    .select("id")
    .eq("genre_type", genreId)
    .limit(1);

  if (programs && programs.length > 0) {
    return NextResponse.json(
      { error: "このジャンル種別を使用しているプログラムがあるため削除できません。先にプログラムのジャンルを変更してください。" },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("genre_types").delete().eq("id", genreId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
