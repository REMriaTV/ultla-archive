import { NextResponse } from "next/server";
import { extractKeywordsWithAI } from "@/lib/extract-keywords";
import { extractTextFromPdf } from "@/lib/extract-pdf-text";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("pdf") as File | null;
    const title = (formData.get("title") as string) || "";

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "PDFファイルを選択してください" },
        { status: 400 }
      );
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    let pdfText = "";
    try {
      pdfText = await extractTextFromPdf(pdfBuffer);
    } catch (err) {
      console.error("PDF text extraction error:", err);
      return NextResponse.json(
        {
          error: "PDFからテキストを抽出できませんでした",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }

    const keywords = await extractKeywordsWithAI(title.trim(), pdfText);

    if (!keywords || keywords.length === 0) {
      return NextResponse.json({
        keywords: [],
        message:
          "ANTHROPIC_API_KEY または OPENAI_API_KEY が未設定か、テキストが抽出できませんでした。.env.local にいずれかを追加してください。",
      });
    }

    return NextResponse.json({
      keywords,
      message: `${keywords.length}個のキーワードを抽出しました`,
    });
  } catch (err) {
    console.error("Extract keywords error:", err);
    return NextResponse.json(
      {
        error: "抽出に失敗しました",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
