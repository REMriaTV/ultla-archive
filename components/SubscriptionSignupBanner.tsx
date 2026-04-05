"use client";

import Link from "next/link";
import { SHOW_PAID_PLAN_UI } from "@/lib/feature-flags";

/**
 * 招待コード期限切れ時または有効なコードがないときに、
 * マイページの招待コードページに表示するサブスク案内。
 * リンク先のサブスク登録画面は Phase 3 で作成予定。
 */
export function SubscriptionSignupBanner() {
  if (!SHOW_PAID_PLAN_UI) return null;
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: "var(--border)",
        background: "var(--card)",
      }}
    >
      <h2
        className="mb-3 text-base font-semibold"
        style={{ color: "var(--fg)" }}
      >
        プランへの加入
      </h2>
      <p
        className="mb-4 text-sm leading-relaxed"
        style={{ color: "var(--fg-muted)" }}
      >
        招待コードの有効期限が切れた方、またはより多くのスライドをご覧になりたい方は、
        PRO または ADVANCE サブスクへの加入をご検討ください。BASIC はログイン済みで無料です。
      </p>
      <div className="mb-4 space-y-2 text-sm" style={{ color: "var(--fg-muted)" }}>
        <p>
          <strong style={{ color: "var(--fg)" }}>BASIC</strong> — ログイン済み・無料。基本コンテンツ＋招待コード紐づきをフル閲覧
        </p>
        <p>
          <strong style={{ color: "var(--fg)" }}>PRO</strong> — サブスク。BASIC ＋ PRO レベルコンテンツをフル閲覧
        </p>
        <p>
          <strong style={{ color: "var(--fg)" }}>ADVANCE</strong> — サブスク。全コンテンツ一括閲覧・ダウンロード可
        </p>
      </div>
      <Link
        href="/mypage/subscription"
        className="inline-block rounded-lg px-4 py-2 text-sm font-medium"
        style={{
          background: "var(--btn-primary-bg)",
          color: "var(--btn-primary-fg)",
        }}
      >
        プラン登録へ
      </Link>
      <p className="mt-2 text-xs" style={{ color: "var(--fg-muted)" }}>
        ※登録画面は準備中です。近日中に提供予定です。
      </p>
    </div>
  );
}
