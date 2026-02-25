import { NextResponse } from "next/server";
import { extractCaptionWithAI } from "@/lib/extract-caption";
import { extractTextFromPdf } from "@/lib/extract-pdf-text";

export const dynamic = "force-dynamic";

/** PDFからキャプションを自動作成 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("pdf") as File | null;
    const title = (formData.get("title") as string | null) ?? "";

    if (!file) {
      return NextResponse.json(
        { error: "PDFファイルを選択してください" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "PDFファイルのみ対応しています" },
        { status: 400 }
      );
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    let pdfText = "";
    try {
      pdfText = await extractTextFromPdf(pdfBuffer);
    } catch (err) {
      console.error("PDF text extraction error:", err);
    }

    const caption = await extractCaptionWithAI(title.trim(), pdfText);

    if (!caption) {
      return NextResponse.json(
        {
          error: "キャプションを生成できませんでした",
          message:
            "ANTHROPIC_API_KEY または OPENAI_API_KEY を .env.local に設定してください。",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ caption, message: "キャプションを生成しました" });
  } catch (err) {
    console.error("Extract caption error:", err);
    const message = err instanceof Error ? err.message : String(err);
    const isFormDataError = /formdata|body|parse/i.test(message);
    return NextResponse.json(
      {
        error: "抽出に失敗しました",
        details: message,
        ...(isFormDataError && {
          hint: "PDFが大きい場合、サーバーの制限で失敗することがあります。しばらく待って再試行するか、PDFを小さくしてからお試しください。",
        }),
      },
      { status: 500 }
    );
  }
}
