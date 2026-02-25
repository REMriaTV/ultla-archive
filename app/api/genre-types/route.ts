import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** ジャンル種別一覧（公開・サイドバー等で使用） */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("genre_types")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Genre types fetch error:", error);
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json(data ?? []);
}
