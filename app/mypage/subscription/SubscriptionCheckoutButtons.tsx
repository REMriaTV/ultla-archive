"use client";

import { useState } from "react";

type Plan = "pro" | "advance";

const SUBSCRIPTION_ENABLED =
  process.env.NEXT_PUBLIC_SUBSCRIPTION_ENABLED === "true";

export function SubscriptionCheckoutButtons({
  currentPlan,
}: {
  currentPlan: string;
}) {
  const [loading, setLoading] = useState<Plan | null>(null);

  const isPaid = currentPlan === "pro" || currentPlan === "advance" || currentPlan === "premium";

  async function handleCheckout(plan: Plan) {
    if (!SUBSCRIPTION_ENABLED) {
      return;
    }
    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      alert(data.error || "チェックアウトの作成に失敗しました");
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(null);
    }
  }

  async function handlePortal() {
    if (!SUBSCRIPTION_ENABLED) {
      return;
    }
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      alert(data.error || "ポータルの作成に失敗しました");
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    }
  }

  const proButtonLabel =
    SUBSCRIPTION_ENABLED
      ? loading === "pro"
        ? "登録処理中..."
        : "PRO プランに登録"
      : "準備中";

  const advanceButtonLabel =
    SUBSCRIPTION_ENABLED
      ? loading === "advance"
        ? "登録処理中..."
        : "ADVANCE プランに登録"
      : "準備中";

  const proDisabled = !!loading || !SUBSCRIPTION_ENABLED;
  const advanceDisabled = !!loading || !SUBSCRIPTION_ENABLED;

  return (
    <div className="space-y-6">
      <section
        className="rounded-xl border p-6"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--fg)" }}
          >
            BASIC（無料）
          </h2>
          {currentPlan === "basic" && (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: "var(--card-hover)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              現在のプラン
            </span>
          )}
        </div>
        <ul
          className="list-disc space-y-1 pl-5 text-sm"
          style={{ color: "var(--fg-muted)" }}
        >
          <li>ログインするだけで利用可能</li>
          <li>公開コンテンツの閲覧（最初の数ページ）</li>
          <li>招待コードによる限定コンテンツの閲覧</li>
        </ul>
      </section>

      <section
        className="rounded-xl border p-6"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--fg)" }}
          >
            PRO（有料プラン・料金検討中）
          </h2>
        </div>
        <ul
          className="mb-4 list-disc space-y-1 pl-5 text-sm"
          style={{ color: "var(--fg-muted)" }}
        >
          <li>BASIC の全機能</li>
          <li>PRO レベルのコンテンツを全ページ閲覧</li>
          <li>研修・セミナー資料へのフルアクセス</li>
        </ul>
        <button
          type="button"
          onClick={() => handleCheckout("pro")}
          disabled={proDisabled}
          className="w-full rounded-lg border px-4 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={
            SUBSCRIPTION_ENABLED
              ? {
                  borderColor: "transparent",
                  background: "var(--btn-primary-bg)",
                  color: "var(--btn-primary-fg)",
                }
              : {
                  borderColor: "var(--border)",
                  background: "var(--card)",
                  color: "var(--fg-muted)",
                }
          }
        >
          {proButtonLabel}
        </button>
      </section>

      <section
        className="rounded-xl border p-6"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--fg)" }}
          >
            ADVANCE（有料プラン・料金検討中）
          </h2>
        </div>
        <ul
          className="mb-4 list-disc space-y-1 pl-5 text-sm"
          style={{ color: "var(--fg-muted)" }}
        >
          <li>PRO の全機能</li>
          <li>全コンテンツの閲覧</li>
          <li>スライドのダウンロードが可能</li>
        </ul>
        <button
          type="button"
          onClick={() => handleCheckout("advance")}
          disabled={advanceDisabled}
          className="w-full rounded-lg border px-4 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={
            SUBSCRIPTION_ENABLED
              ? {
                  borderColor: "var(--border)",
                  background: "var(--card)",
                  color: "var(--fg)",
                }
              : {
                  borderColor: "var(--border)",
                  background: "var(--card)",
                  color: "var(--fg-muted)",
                }
          }
        >
          {advanceButtonLabel}
        </button>
      </section>

      {isPaid && SUBSCRIPTION_ENABLED && (
        <section>
          <button
            type="button"
            onClick={handlePortal}
            className="w-full rounded-lg border px-4 py-3 text-sm font-medium"
            style={{
              borderColor: "var(--border)",
              background: "var(--card)",
              color: "var(--fg)",
            }}
          >
            プラン管理・解約（Stripe のポータルへ）
          </button>
        </section>
      )}
    </div>
  );
}
