import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET_NAME = "slides";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  // 動的ルートの id が number で渡ることがあるため、Storage path 用は必ず文字列にする
  const id = rawId != null ? String(rawId) : "";

  if (!id) {
    return NextResponse.json(
      { error: "Slide ID is required" },
      { status: 400 }
    );
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY required" },
      { status: 500 }
    );
  }

  try {
    const { data: slide, error: fetchError } = await supabaseAdmin
      .from("slides")
      .select("id, pdf_url, title")
      .eq("id", id)
      .single();

    if (fetchError || !slide?.pdf_url) {
      return NextResponse.json(
        { error: "Slide not found or has no pdf_url" },
        { status: 404 }
      );
    }

    const pdfResponse = await fetch(slide.pdf_url);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${pdfResponse.statusText}` },
        { status: 502 }
      );
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    const { pdfToImageBuffers } = await import("@/lib/pdf-to-images");
    const imageBuffers = await pdfToImageBuffers(pdfBuffer);

    const pageImageUrls: string[] = [];
    let pageIndex = 1;

    for (const image of imageBuffers) {
      const fileName = `pages/page_${pageIndex}.png`;
      const storagePath = `${id}/${fileName}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(String(storagePath), image, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return NextResponse.json(
          {
            error: "Failed to upload page image",
            details: uploadError.message,
          },
          { status: 500 }
        );
      }

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
      pageImageUrls.push(publicUrl);
      pageIndex++;
    }

    const { error: updateError } = await supabaseAdmin
      .from("slides")
      .update({
        page_count: pageImageUrls.length,
        page_image_urls: pageImageUrls,
        image_url: pageImageUrls[0] ?? null,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update slide", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pageCount: pageImageUrls.length,
      pageImageUrls,
    });
  } catch (err) {
    console.error("Convert error:", err);
    return NextResponse.json(
      {
        error: "Conversion failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
