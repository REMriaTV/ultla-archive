import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEFAULT_SUBTITLE = "いつでも、どこでも、学びのレシピ";
const DEFAULT_FOOTER_TEXT = "SPACE ARCHIVE — いつでも、どこでも、学びのレシピ";

/** トップページ用。サブタイトル・フッター文言を返す（認証不要） */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("subtitle, footer_text")
    .eq("id", "main")
    .single();

  if (error || !data) {
    return NextResponse.json({
      subtitle: DEFAULT_SUBTITLE,
      footer_text: DEFAULT_FOOTER_TEXT,
    });
  }

  return NextResponse.json({
    subtitle: typeof data.subtitle === "string" ? data.subtitle : DEFAULT_SUBTITLE,
    footer_text: typeof data.footer_text === "string" ? data.footer_text : DEFAULT_FOOTER_TEXT,
  });
}
