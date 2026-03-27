import type { SupabaseClient } from "@supabase/supabase-js";

export type Plan = "free" | "basic" | "pro" | "advance" | "premium";

export interface AccessContext {
  userId: string | null;
  plan: Plan;
  /** 有効期限内の招待コードに紐づくスライドID一覧。premium/advance 等の場合は null（プランで制御） */
  accessibleSlideIds: Set<string> | null;
  /** 有効期限内の招待コードに紐づく動画ID一覧。premium/advance 等の場合は null（プランで制御） */
  accessibleVideoIds: Set<string> | null;
  /** 管理者（管理画面・PDFダウンロード可） */
  isAdmin: boolean;
  /** コアスタッフ（管理画面権限なし、視聴は管理者同等） */
  isCoreStaff: boolean;
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
    return { userId: null, plan: "free", accessibleSlideIds: new Set(), accessibleVideoIds: new Set(), isAdmin: false, isCoreStaff: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, is_admin, is_core_staff")
    .eq("id", user.id)
    .single();

  const plan = (profile?.plan as Plan) ?? "basic";
  const isAdmin = profile?.is_admin === true;
  const isCoreStaff = profile?.is_core_staff === true;

  // 管理者・コアスタッフ・advance/premium は全閲覧のため null
  if (isAdmin || isCoreStaff || plan === "premium" || plan === "advance") {
    return { userId: user.id, plan, accessibleSlideIds: null, accessibleVideoIds: null, isAdmin, isCoreStaff };
  }

  const { data: userCodes } = await supabase
    .from("user_invite_codes")
    .select("invite_code_id")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString());

  const codeIds = (userCodes ?? []).map((r) => r.invite_code_id);
  if (codeIds.length === 0) {
    return { userId: user.id, plan: "basic", accessibleSlideIds: new Set(), accessibleVideoIds: new Set(), isAdmin, isCoreStaff };
  }

  if (!supabaseAdmin) {
    return { userId: user.id, plan: "basic", accessibleSlideIds: new Set(), accessibleVideoIds: new Set(), isAdmin, isCoreStaff };
  }

  const [{ data: slideLinks }, { data: videoLinks }] = await Promise.all([
    supabaseAdmin
      .from("invite_code_slides")
      .select("slide_id")
      .in("invite_code_id", codeIds),
    supabaseAdmin
      .from("invite_code_videos")
      .select("video_id")
      .in("invite_code_id", codeIds),
  ]);

  const slideIds = new Set((slideLinks ?? []).map((r) => String(r.slide_id)));
  const videoIds = new Set((videoLinks ?? []).map((r) => String(r.video_id)));
  return { userId: user.id, plan: "basic", accessibleSlideIds: slideIds, accessibleVideoIds: videoIds, isAdmin, isCoreStaff };
}

/** スライドの全ページを閲覧可能か（4枚制限を超えられるか） */
export function hasFullAccessToSlide(
  slide: { id: string | number; content_tier?: string | null },
  ctx: AccessContext
): boolean {
  if (ctx.isAdmin || ctx.isCoreStaff) return true;
  // 有料プラン: content_tier に応じて付与
  const tier = slide.content_tier ?? "basic";
  if (ctx.plan === "premium" || ctx.plan === "advance") return true;
  if (ctx.plan === "pro" && (tier === "basic" || tier === "pro")) return true;
  if (ctx.plan === "basic" && tier === "basic") return true;
  // 招待コードで紐づいている場合は全ページ可
  if (ctx.accessibleSlideIds !== null && ctx.accessibleSlideIds.has(String(slide.id))) return true;
  return false;
}

/** スライドがユーザーに表示可能か（管理者は招待コードに関係なく全スライド可） */
export function canViewSlide(
  slide: { id: string | number; visibility?: string | null },
  ctx: AccessContext
): boolean {
  if (ctx.isAdmin || ctx.isCoreStaff) return true;
  const vis = slide.visibility ?? "private";
  if (vis === "free") return true;
  if (ctx.accessibleSlideIds === null) return true; // 有料プラン（一覧は canViewSlide で visibility ベース、ここでは full access は hasFullAccessToSlide で判定）
  if (vis === "invite_only" && ctx.accessibleSlideIds.has(String(slide.id))) return true;
  return false;
}

/** 動画がユーザーに表示可能か（管理者・コアスタッフは全動画可） */
export function canViewVideo(
  video: { id: string | number; visibility?: string | null; content_tier?: string | null; is_published?: boolean | null },
  ctx: AccessContext
): boolean {
  if (video.is_published === false && !ctx.isAdmin && !ctx.isCoreStaff) return false;
  if (ctx.isAdmin || ctx.isCoreStaff) return true;
  const vis = video.visibility ?? "free";
  if (vis === "private") return false;
  const tier = video.content_tier ?? "basic";
  if (ctx.plan === "advance" || ctx.plan === "premium") return true;
  if (ctx.plan === "pro") {
    return (tier === "basic" || tier === "pro") &&
      (vis !== "invite_only" || (ctx.accessibleVideoIds !== null && ctx.accessibleVideoIds.has(String(video.id))));
  }
  if (ctx.plan === "basic") {
    return tier === "basic" && (vis === "free" || (vis === "invite_only" && ctx.accessibleVideoIds !== null && ctx.accessibleVideoIds.has(String(video.id))));
  }
  return vis === "free" && tier === "basic";
}

/** スライド一覧をフィルタ */
export function filterVisibleSlides<T extends { id: string; visibility?: string | null }>(
  slides: T[],
  ctx: AccessContext
): T[] {
  return slides.filter((s) => canViewSlide(s, ctx));
}
