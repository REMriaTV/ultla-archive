import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const BILLING_ENABLED = process.env.STRIPE_BILLING_ENABLED === "true";

/** 顧客ポータル（サブスク管理・解約）の URL を返す。ログイン必須。 */
export async function POST() {
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

  if (!user?.id) {
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

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId = sub?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json(
      { error: "サブスク登録がありません。プラン登録からお申し込みください。" },
      { status: 400 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";
  const base = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/mypage/subscription`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe portal error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "ポータルの作成に失敗しました",
      },
      { status: 500 }
    );
  }
}
