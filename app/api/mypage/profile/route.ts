import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED_THEMES = [
  "",
  "light-water",
  "dark-light",
  "warm-refined",
  "blue-orange",
] as const;

/** 自分のプロファイル取得（テーマ等） */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("plan, is_admin, preferred_theme")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json(
      { error: "プロファイルを取得できませんでした" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    plan: profile.plan,
    is_admin: profile.is_admin === true,
    preferred_theme: profile.preferred_theme ?? "",
  });
}

/** テーマなどプロファイルの一部を更新 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const preferredTheme =
    typeof body.preferred_theme === "string" ? body.preferred_theme : undefined;

  if (preferredTheme !== undefined) {
    const theme = ALLOWED_THEMES.includes(
      preferredTheme as (typeof ALLOWED_THEMES)[number]
    )
      ? preferredTheme
      : "";
    const { error } = await supabase
      .from("profiles")
      .update({
        preferred_theme: theme || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "テーマの保存に失敗しました" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
