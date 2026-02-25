import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractCaptionWithAI } from "@/lib/extract-caption";
import { extractKeywordsWithAI } from "@/lib/extract-keywords";
import { extractTextFromPdf } from "@/lib/extract-pdf-text";

const BUCKET_NAME = "slides";

export const dynamic = "force-dynamic";

function mergeKeywords(userTags: string[], aiTags: string[] | null): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of userTags) {
    const key = t.toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(t.trim());
    }
  }
  if (aiTags) {
    for (const t of aiTags) {
      const key = t.toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(t.trim());
      }
    }
  }
  return result;
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY が必要です" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("pdf") as File | null;
    const title = formData.get("title") as string | null;
    const programId = formData.get("program_id") as string | null;
    const yearStr = formData.get("year") as string | null;
    const tagsStr = formData.get("keyword_tags") as string | null;
    const captionStr = formData.get("caption") as string | null;
    const visibilityStr = formData.get("visibility") as string | null;
    const visibility = visibilityStr && ["free", "invite_only", "private"].includes(visibilityStr)
      ? visibilityStr
      : "free";

    if (!file || !title?.trim() || !programId) {
      return NextResponse.json(
        { error: "PDF、タイトル、プログラムは必須です" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "PDFファイルのみアップロードできます" },
        { status: 400 }
      );
    }

    const year = yearStr ? parseInt(yearStr, 10) : null;
    const userTags = tagsStr
      ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    // キーワード自動抽出（ANTHROPIC_API_KEY または OPENAI_API_KEY が設定されている場合）
    let pdfText = "";
    try {
      pdfText = await extractTextFromPdf(pdfBuffer);
    } catch {
      // テキスト抽出に失敗しても続行
    }

    const [aiTags, aiCaption] = await Promise.all([
      extractKeywordsWithAI(title.trim(), pdfText),
      extractCaptionWithAI(title.trim(), pdfText),
    ]);
    const keywordTags = mergeKeywords(userTags, aiTags);
    const caption = captionStr?.trim() || aiCaption || null;

    // 1. スライドレコードを先に作成（IDを取得）
    const { data: newSlide, error: insertError } = await supabaseAdmin
      .from("slides")
      .insert({
        program_id: programId,
        title: title.trim(),
        keyword_tags: keywordTags,
        year,
        caption,
        visibility,
      })
      .select("id")
      .single();

    if (insertError || !newSlide) {
      return NextResponse.json(
        { error: "スライドの作成に失敗しました", details: insertError?.message },
        { status: 500 }
      );
    }

    // DBの id が number で返る場合があるため、Storage path 用は必ず文字列にする（number が渡ると "path must be string" になる）
    const slideId = String(newSlide.id);

    // 2. PDFをStorageにアップロード
    const pdfPath = `${slideId}/original.pdf`;

    const { error: pdfUploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(String(pdfPath), pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (pdfUploadError) {
      await supabaseAdmin.from("slides").delete().eq("id", newSlide.id);
      return NextResponse.json(
        { error: "PDFのアップロードに失敗しました", details: pdfUploadError.message },
        { status: 500 }
      );
    }

    const { data: { publicUrl: pdfUrl } } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(pdfPath);

    // 3. pdf_urlをDBに保存
    await supabaseAdmin
      .from("slides")
      .update({ pdf_url: pdfUrl })
      .eq("id", newSlide.id);

    // 4. PDFを画像に変換（pdf2pic優先、失敗時はpdf-to-img）
    const { pdfToImageBuffers } = await import("@/lib/pdf-to-images");
    const imageBuffers = await pdfToImageBuffers(pdfBuffer);

    const pageImageUrls: string[] = [];
    let pageIndex = 1;

    for (const image of imageBuffers) {
      const fileName = `pages/page_${pageIndex}.png`;
      const storagePath = `${slideId}/${fileName}`;
      const { error: imgUploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(String(storagePath), image, {
          contentType: "image/png",
          upsert: true,
        });

      if (imgUploadError) {
        return NextResponse.json(
          {
            error: "画像のアップロードに失敗しました",
            details: imgUploadError.message,
            slideId,
          },
          { status: 500 }
        );
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);
      pageImageUrls.push(publicUrl);
      pageIndex++;
    }

    // 5. page_count, page_image_urls, image_url（サムネイル＝1枚目）を更新
    await supabaseAdmin
      .from("slides")
      .update({
        page_count: pageImageUrls.length,
        page_image_urls: pageImageUrls,
        image_url: pageImageUrls[0] ?? null,
      })
      .eq("id", newSlide.id);

    return NextResponse.json({
      success: true,
      slideId,
      pageCount: pageImageUrls.length,
    });
  } catch (err) {
    console.error("Create slide error:", err);
    return NextResponse.json(
      {
        error: "作成に失敗しました",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
