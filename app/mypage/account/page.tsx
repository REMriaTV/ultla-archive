import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function MypageAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const accessCtx = await getAccessContext(supabase, supabaseAdmin ?? null);

  if (!user) return null;

  const accessLabel =
    accessCtx.isAdmin
      ? "管理者（全スライド・ダウンロード可）"
      : accessCtx.plan === "premium" || accessCtx.plan === "advance"
        ? "全スライド閲覧・ダウンロード可"
        : accessCtx.plan === "pro" || accessCtx.plan === "basic"
          ? `${accessCtx.plan.toUpperCase()}プランで閲覧可能`
          : accessCtx.accessibleSlideIds && accessCtx.accessibleSlideIds.size > 0
            ? "招待コードで閲覧可能"
            : "招待コードを追加するとスライドが表示されます";

  return (
    <div className="mx-auto max-w-2xl">
      <h1
        className="mb-6 text-xl font-semibold"
        style={{ color: "var(--fg)" }}
      >
        アカウント情報
      </h1>
      <dl
        className="flex flex-col gap-4 rounded-xl border p-5"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
        }}
      >
        <div>
          <dt
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            メール
          </dt>
          <dd className="mt-1 text-sm" style={{ color: "var(--fg)" }}>
            {user.email ?? "—"}
          </dd>
        </div>
        <div>
          <dt
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--fg-muted)" }}
          >
            アクセス範囲
          </dt>
          <dd className="mt-1 text-sm" style={{ color: "var(--fg)" }}>
            {accessLabel}
          </dd>
        </div>
      </dl>
    </div>
  );
}
