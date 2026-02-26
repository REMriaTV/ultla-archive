import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Resend } from "resend";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? "bank@space-inc.jp";
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL ?? "onboarding@resend.dev";
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export const dynamic = "force-dynamic";

/** お問い合わせに返信メールを送る（管理者のみ） */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (profile?.is_admin !== true) {
    return NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { data: inquiry, error: fetchError } = await supabaseAdmin
    .from("inquiries")
    .select("id, name, email, subject, body")
    .eq("id", id)
    .single();

  if (fetchError || !inquiry) {
    return NextResponse.json({ error: "お問い合わせが見つかりません" }, { status: 404 });
  }

  let body: { subject?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  const replySubject = typeof body.subject === "string" ? body.subject.trim() : "";
  const replyBody = typeof body.body === "string" ? body.body.trim() : "";
  if (!replySubject || !replyBody) {
    return NextResponse.json({ error: "件名と本文は必須です" }, { status: 400 });
  }

  if (!resend) {
    return NextResponse.json(
      { error: "メール送信の設定（RESEND_API_KEY）がありません" },
      { status: 500 }
    );
  }

  try {
    await resend.emails.send({
      from: CONTACT_FROM_EMAIL,
      to: inquiry.email,
      replyTo: CONTACT_EMAIL,
      subject: replySubject,
      text: replyBody,
    });
  } catch (err) {
    console.error("Resend reply error:", err);
    return NextResponse.json(
      { error: "メールの送信に失敗しました" },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("inquiries")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    // メールは送れたので 200 を返す
  }

  return NextResponse.json({ success: true });
}
