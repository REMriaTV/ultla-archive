import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** サイドバー用：表示対象のプログラム一覧（ジャンル別表示用） */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select("id, name, slug, genre_type")
    .or("show_on_front.is.null,show_on_front.eq.true")
    .order("started_year", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const programs = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    genre_type: p.genre_type ?? "program",
  }));

  return NextResponse.json(programs);
}
