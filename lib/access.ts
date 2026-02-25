import type { SupabaseClient } from "@supabase/supabase-js";

export interface AccessContext {
  userId: string | null;
  plan: "free" | "premium";
  /** 有効期限内の招待コードに紐づくスライドID一覧。premium の場合は null（全件可） */
  accessibleSlideIds: Set<string> | null;
  /** 管理者（管理画面・PDFダウンロード可） */
  isAdmin: boolean;
}

/**
 * ユーザーのアクセスコンテキストを取得。
 * - premium: 全スライド閲覧可（accessibleSlideIds = null）
 * - 未ログイン: visibility='free' のみ（accessibleSlideIds = empty Set）
 * - ログイン済み: visibility='free' ∪ (visibility='invite_only' かつ accessibleSlideIds に含まれる)
 *
 * @param supabase ユーザーセッション用（auth, profiles, user_invite_codes）
 * @param supabaseAdmin invite_code_slides 取得用（RLS でブロックされているため）
 */
export async function getAccessContext(
  supabase: SupabaseClient,
  supabaseAdmin: SupabaseClient | null
): Promise<AccessContext> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { userId: null, plan: "free", accessibleSlideIds: new Set(), isAdmin: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, is_admin")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan as "free" | "premium") ?? "free";
  const isAdmin = profile?.is_admin === true;

  if (plan === "premium") {
    return { userId: user.id, plan: "premium", accessibleSlideIds: null, isAdmin };
  }

  const { data: userCodes } = await supabase
    .from("user_invite_codes")
    .select("invite_code_id")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString());

  const codeIds = (userCodes ?? []).map((r) => r.invite_code_id);
  if (codeIds.length === 0) {
    return { userId: user.id, plan: "free", accessibleSlideIds: new Set(), isAdmin };
  }

  if (!supabaseAdmin) {
    return { userId: user.id, plan: "free", accessibleSlideIds: new Set(), isAdmin };
  }

  const { data: links } = await supabaseAdmin
    .from("invite_code_slides")
    .select("slide_id")
    .in("invite_code_id", codeIds);

  const ids = new Set((links ?? []).map((r) => String(r.slide_id)));
  return { userId: user.id, plan: "free", accessibleSlideIds: ids, isAdmin };
}

/** スライドがユーザーに表示可能か（管理者は招待コードに関係なく全スライド可） */
export function canViewSlide(
  slide: { id: string | number; visibility?: string | null },
  ctx: AccessContext
): boolean {
  if (ctx.isAdmin) return true;
  const vis = slide.visibility ?? "private";
  if (vis === "free") return true;
  if (ctx.accessibleSlideIds === null) return true; // premium
  if (vis === "invite_only" && ctx.accessibleSlideIds.has(String(slide.id))) return true;
  return false;
}

/** スライド一覧をフィルタ */
export function filterVisibleSlides<T extends { id: string; visibility?: string | null }>(
  slides: T[],
  ctx: AccessContext
): T[] {
  return slides.filter((s) => canViewSlide(s, ctx));
}
