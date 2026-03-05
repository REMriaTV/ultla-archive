import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SubscriptionSignupBanner } from "@/components/SubscriptionSignupBanner";
import { InviteCodeList } from "./InviteCodeList";
import { InviteCodeForm } from "./InviteCodeForm";

export default async function MypageInviteCodesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userCodes } = await supabase
    .from("user_invite_codes")
    .select("invite_code_id, expires_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  let items: { invite_code_id: string; name: string; code: string; expires_at: string; created_at: string }[] = [];
  if (userCodes?.length && supabaseAdmin) {
    const codeIds = userCodes.map((r) => r.invite_code_id);
    const { data: codes } = await supabaseAdmin
      .from("invite_codes")
      .select("id, name, code")
      .in("id", codeIds);
    const byId = new Map((codes ?? []).map((c) => [c.id, c]));
    items = userCodes
      .filter((u) => byId.has(u.invite_code_id))
      .map((u) => {
        const inv = byId.get(u.invite_code_id)!;
        return {
          invite_code_id: u.invite_code_id,
          name: inv.name ?? inv.code,
          code: inv.code,
          expires_at: u.expires_at,
          created_at: u.created_at,
        };
      });
  }

  const now = new Date();
  const hasValidCodes = items.some((item) => new Date(item.expires_at) > now);

  return (
    <div className="mx-auto max-w-2xl">
      <h1
        className="mb-6 text-xl font-semibold"
        style={{ color: "var(--fg)" }}
      >
        招待コード
      </h1>
      <p
        className="mb-4 text-sm"
        style={{ color: "var(--fg-muted)" }}
      >
        登録した招待コードと有効期限です。コードを追加すると、紐づいたスライドが閲覧できます。招待コードは期限付きです。有効期限を過ぎると閲覧できなくなります。
      </p>
      <InviteCodeForm className="mb-6" />
      <InviteCodeList items={items} />
      {!hasValidCodes && (
        <div className="mt-8">
          <SubscriptionSignupBanner />
        </div>
      )}
    </div>
  );
}
