import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAccessContext, filterVisibleSlides } from "@/lib/access";

export const dynamic = "force-dynamic";

/** キーワード検索（アクセス制御を適用） */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.toLowerCase().trim() ?? "";

  const supabase = await createClient();
  const { data: slides, error } = await supabase.from("slides").select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const accessCtx = await getAccessContext(supabase, supabaseAdmin ?? null);
  const visible = filterVisibleSlides(slides ?? [], accessCtx);

  const filtered =
    q === ""
      ? []
      : visible.filter((s) => {
          const titleMatch = s.title?.toLowerCase().includes(q);
          const tagMatch = Array.isArray(s.keyword_tags)
            ? s.keyword_tags.some((t: string) => String(t).toLowerCase().includes(q))
            : false;
          return titleMatch || tagMatch;
        });

  return NextResponse.json(filtered);
}
