import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Resend } from "resend";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? "bank@space-inc.jp";
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL ?? "onboarding@resend.dev";
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  let body: { name?: string; email?: string; subject?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const textBody = typeof body.body === "string" ? body.body.trim() : "";

  if (!name || !email || !subject || !textBody) {
    return NextResponse.json(
      { error: "お名前・メールアドレス・件名・お問い合わせ内容は必須です" },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "サーバー設定エラー" }, { status: 500 });
  }

  const { data: row, error: insertError } = await supabaseAdmin
    .from("inquiries")
    .insert({
      user_id: user.id,
      name,
      email,
      subject,
      body: textBody,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("inquiries insert error:", insertError);
    return NextResponse.json({ error: "送信の保存に失敗しました" }, { status: 500 });
  }

  if (resend) {
    try {
      await resend.emails.send({
        from: CONTACT_FROM_EMAIL,
        to: CONTACT_EMAIL,
        replyTo: email,
        subject: `[SPACE ARCHIVE] ${subject}`,
        text: `お名前: ${name}\nメール: ${email}\n\n${textBody}`,
      });
    } catch (err) {
      console.error("Resend send error:", err);
      // 保存は済んでいるので 200 のまま返す（メールだけ失敗）
    }
  }

  return NextResponse.json({ ok: true, id: row?.id });
}
