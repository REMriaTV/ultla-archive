import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SHOW_PAID_PLAN_UI } from "@/lib/feature-flags";
import { SubscriptionCheckoutButtons } from "./SubscriptionCheckoutButtons";

const PLAN_LABELS: Record<string, string> = {
  basic: "BASIC",
  pro: "PRO",
  advance: "ADVANCE",
  premium: "ADVANCE",
};

export default async function MypageSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  if (!SHOW_PAID_PLAN_UI) {
    redirect("/mypage/settings");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan ?? "basic";
  const params = await searchParams;
  const showSuccess = params.success === "1";
  const showCanceled = params.canceled === "1";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold" style={{ color: "var(--fg)" }}>
        プラン登録
      </h1>

      <div
        className="mb-6 rounded-lg border px-4 py-3 text-sm"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
          color: "var(--fg)",
        }}
      >
        <p className="mb-1 font-medium">プラン機能は現在 準備中です</p>
        <p className="mb-1">
          このページでは、今後追加される予定の BASIC / PRO / ADVANCE プランのイメージをご案内しています。
        </p>
        <p className="mb-1">
          実際のプラン登録・変更は、準備が整い次第このページから行えるようになる予定です（具体的な価格は検討中です）。
        </p>
        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
          それまでは、招待コードをお持ちの方を対象とした試用運用として公開しています。
        </p>
      </div>

      {showSuccess && (
        <p
          className="mb-4 rounded-lg border p-3 text-sm"
          style={{
            borderColor: "var(--accent)",
            background: "var(--card)",
            color: "var(--fg)",
          }}
        >
          登録が完了しました。現在のプランでコンテンツをご利用いただけます。
        </p>
      )}
      {showCanceled && (
        <p
          className="mb-4 text-sm"
          style={{ color: "var(--fg-muted)" }}
        >
          登録をキャンセルしました。いつでも再度お申し込みいただけます。
        </p>
      )}

      <SubscriptionCheckoutButtons currentPlan={plan} />

      <div className="mt-6 mb-4 text-sm" style={{ color: "var(--fg-muted)" }}>
        <p className="mb-1">
          PRO / ADVANCE は月額制のサブスクリプション（自動更新）です。
        </p>
        <p className="mb-1">
          解約はマイページからいつでも可能で、次回請求日まで引き続きご利用いただけます。
        </p>
        <p className="mb-1">
          お支払いにはクレジットカード（Visa / Mastercard / JCB / Amex）をご利用いただけます。
        </p>
        <p>
          サービス開始時には、改めてお知らせにてご案内いたします。
        </p>
      </div>

      <Link
        href="/mypage/settings"
        className="text-sm font-medium"
        style={{ color: "var(--accent)" }}
      >
        ← アカウントに戻る
      </Link>
    </div>
  );
}
