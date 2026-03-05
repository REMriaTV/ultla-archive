import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const BILLING_ENABLED = process.env.STRIPE_BILLING_ENABLED === "true";

const PRICE_IDS: Record<string, string> = {
  pro: process.env.STRIPE_PRICE_ID_PRO ?? "",
  advance: process.env.STRIPE_PRICE_ID_ADVANCE ?? "",
};

/** PRO または ADVANCE のチェックアウトセッションを作成。ログイン必須。 */
export async function POST(request: Request) {
  if (!BILLING_ENABLED) {
    return NextResponse.json(
      { error: "プラン決済は現在準備中です" },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json(
      { error: "ログインが必要です" },
      { status: 401 }
    );
  }

  if (!stripe || !supabaseAdmin) {
    return NextResponse.json(
      { error: "決済の準備ができていません" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const plan = body.plan === "pro" || body.plan === "advance" ? body.plan : null;
  const priceId = plan ? PRICE_IDS[plan] : null;

  if (!priceId) {
    return NextResponse.json(
      { error: "plan は 'pro' または 'advance' を指定してください" },
      { status: 400 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";
  const base = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: { user_id: user.id },
      },
      success_url: `${base}/mypage/subscription?success=1`,
      cancel_url: `${base}/mypage/subscription?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "チェックアウトの作成に失敗しました",
      },
      { status: 500 }
    );
  }
}
