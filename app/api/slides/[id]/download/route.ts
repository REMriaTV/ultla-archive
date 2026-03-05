import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET_NAME = "slides";

export const dynamic = "force-dynamic";

/** プレミアムユーザーまたは管理者のみ PDF ダウンロードを許可 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", _request.url));
  }

  // プロファイルでプラン・管理者確認（プレミアムまたは管理者のみダウンロード可）
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, is_admin")
    .eq("id", user.id)
    .single();

  const isPremium = profile?.plan === "premium" || profile?.plan === "advance";
  const isAdmin = profile?.is_admin === true;
  if (!isPremium && !isAdmin) {
    return NextResponse.json(
      { error: "この機能はADVANCEプランまたは管理者限定です" },
      { status: 403 }
    );
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  // スライドの pdf_url を確認
  const { data: slide, error: slideError } = await supabaseAdmin
    .from("slides")
    .select("pdf_url, title")
    .eq("id", id)
    .single();

  if (slideError || !slide?.pdf_url) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Storage から PDF を取得（original.pdf が確実にある場合）
  const pdfPath = `${id}/original.pdf`;
  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .download(pdfPath);

  if (downloadError || !fileData) {
    // Storage にない場合は pdf_url にリダイレクト（公開 URL の場合）
    return NextResponse.redirect(slide.pdf_url);
  }

  // ファイル名用: 危険な文字を除き、長さ制限（日本語はスライド名のまま）
  const rawTitle = (slide.title || "slide").trim().slice(0, 100);
  const safeForFilename = rawTitle.replace(/[\\/:*?"<>|]/g, "").trim() || "slide";
  // RFC 5987: 日本語は filename*=UTF-8'' で渡す（ブラウザがスライド名で保存する）
  const encodedFilename = encodeURIComponent(safeForFilename + ".pdf");
  const contentDisposition = `attachment; filename="download.pdf"; filename*=UTF-8''${encodedFilename}`;

  return new NextResponse(fileData, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition,
    },
  });
}
