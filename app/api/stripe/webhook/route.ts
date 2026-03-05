import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const PRICE_ID_ADVANCE = process.env.STRIPE_PRICE_ID_ADVANCE ?? "";

/** 価格 ID からプラン判定（ADVANCE の price なら advance、それ以外は pro） */
function planFromPriceId(priceId: string): "pro" | "advance" {
  return priceId === PRICE_ID_ADVANCE ? "advance" : "pro";
}

/** Stripe Webhook: サブスクの作成・更新・削除で subscriptions と profiles.plan を同期 */
export async function POST(request: Request) {
  if (!stripe || !webhookSecret || !supabaseAdmin) {
    return NextResponse.json(
      { error: "Webhook の設定がありません" },
      { status: 503 }
    );
  }

  const headersList = await headers();
  const sig = headersList.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "stripe-signature がありません" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        const plan =
          sub.status === "active" || sub.status === "trialing"
            ? planFromPriceId(sub.items.data[0]?.price?.id ?? "")
            : null;

        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        const periodStart = sub.current_period_start
          ? new Date(sub.current_period_start * 1000).toISOString()
          : null;

        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: sub.customer as string,
            stripe_subscription_id: sub.id,
            plan: plan ?? "pro",
            status: sub.status,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

        if (plan) {
          await supabaseAdmin
            .from("profiles")
            .update({ plan, updated_at: new Date().toISOString() })
            .eq("id", userId);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        await supabaseAdmin
          .from("subscriptions")
          .delete()
          .eq("user_id", userId);

        await supabaseAdmin
          .from("profiles")
          .update({ plan: "basic", updated_at: new Date().toISOString() })
          .eq("id", userId);
        break;
      }
      default:
        // 他のイベントは無視
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "処理に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
