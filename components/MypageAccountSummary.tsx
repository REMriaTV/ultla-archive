import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** マイページ「アカウント」内に表示するメール・アクセス範囲（サーバー） */
export async function MypageAccountSummary() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const accessCtx = await getAccessContext(supabase, supabaseAdmin ?? null);

  if (!user) return null;

  /** 表向きプラン名は出さない（Stripe 等はシステムに保持） */
  const accessLabel =
    accessCtx.isAdmin
      ? "管理者（全スライド・ダウンロード可）"
      : accessCtx.isCoreStaff
        ? "コアスタッフ（全コンテンツ視聴可）"
        : accessCtx.plan === "premium" || accessCtx.plan === "advance"
          ? "全スライドの閲覧・ダウンロードが可能です"
          : accessCtx.plan === "pro" || accessCtx.plan === "basic"
            ? "ログイン済みです。公開されているコンテンツをご覧いただけます"
            : accessCtx.accessibleSlideIds && accessCtx.accessibleSlideIds.size > 0
              ? "登録された閲覧権に基づき、一部のコンテンツをフルでご覧いただけます"
              : "ログイン済みです。コンテンツは公開設定に従って表示されます";

  return (
    <section className="p-5 sm:p-6">
      <dl className="flex flex-col gap-6">
        <div>
          <dt
            className="mb-1.5 text-sm font-medium"
            style={{ color: "var(--fg-muted)" }}
          >
            メールアドレス
          </dt>
          <dd
            className="break-all text-base leading-relaxed"
            style={{ color: "var(--fg)" }}
          >
            {user.email ?? "—"}
          </dd>
        </div>
        <div>
          <dt
            className="mb-1.5 text-sm font-medium"
            style={{ color: "var(--fg-muted)" }}
          >
            アクセス範囲
          </dt>
          <dd className="text-base leading-relaxed" style={{ color: "var(--fg)" }}>
            {accessLabel}
          </dd>
        </div>
      </dl>
    </section>
  );
}
