import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** マイリストに登録しているスライドID一覧 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("user_slides")
    .select("slide_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Mylist GET error:", error);
    return NextResponse.json(
      { error: "マイリストの取得に失敗しました" },
      { status: 500 }
    );
  }

  const slideIds = (rows ?? []).map((r) => String(r.slide_id));
  return NextResponse.json({ slideIds });
}

/** マイリストにスライドを追加 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const slideId = typeof body.slide_id === "string" ? body.slide_id.trim() : null;
  if (!slideId) {
    return NextResponse.json(
      { error: "slide_id を指定してください" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("user_slides").upsert(
    { user_id: user.id, slide_id: slideId },
    { onConflict: "user_id,slide_id" }
  );

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "存在しないスライドです" },
        { status: 404 }
      );
    }
    console.error("Mylist POST error:", error);
    return NextResponse.json(
      { error: "マイリストに追加できませんでした" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, added: true });
}

/** マイリストからスライドを削除 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const url = new URL(request.url);
  let slideId = url.searchParams.get("slide_id");
  if (!slideId) {
    const body = await request.json().catch(() => ({}));
    slideId = typeof body.slide_id === "string" ? body.slide_id.trim() : null;
  }
  if (!slideId) {
    return NextResponse.json(
      { error: "slide_id を指定してください" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("user_slides")
    .delete()
    .eq("user_id", user.id)
    .eq("slide_id", slideId);

  if (error) {
    console.error("Mylist DELETE error:", error);
    return NextResponse.json(
      { error: "マイリストから削除できませんでした" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, removed: true });
}
