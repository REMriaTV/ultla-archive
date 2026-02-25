/**
 * PDFを画像バッファの配列に変換する。
 * 1. pdf2pic（GraphicsMagick）を優先（高画質・縞模様なし）
 * 2. 失敗時は pdf-to-img にフォールバック
 *
 * 両方の出力に sharp で後処理を適用：
 * - 透過を白背景に flatten（色ずれ対策）
 * - 幅 1920px にリサイズ（大きすぎる画像を抑制）
 *
 * pdf2pic を使うには GraphicsMagick と Ghostscript のインストールが必要:
 *   macOS: brew install graphicsmagick ghostscript
 */
import sharp from "sharp";

const MAX_WIDTH = 1920;

/** 各画像バッファに sharp で後処理（白背景 flatten + リサイズ）を適用 */
async function processImageBuffer(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .flatten({ background: "#ffffff" })
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

export async function pdfToImageBuffers(pdfBuffer: Buffer): Promise<Buffer[]> {
  const startTime = Date.now();
  let library: "pdf2pic" | "pdf-to-img" = "pdf-to-img";
  let rawBuffers: Buffer[] = [];

  // 1. pdf2pic を試行（GraphicsMagick - 高画質）
  try {
    const { fromBuffer } = await import("pdf2pic");
    const convert = fromBuffer(pdfBuffer, {
      density: 200, // DPI（高めで鮮明に）
      format: "png",
      preserveAspectRatio: true,
    });
    const results = await convert.bulk(-1, { responseType: "buffer" });
    if (Array.isArray(results) && results.length > 0) {
      rawBuffers = results
        .map((r) => r.buffer)
        .filter((b): b is Buffer => Buffer.isBuffer(b));
      if (rawBuffers.length > 0) {
        library = "pdf2pic";
      }
    }
  } catch (e) {
    console.warn("pdf2pic failed, falling back to pdf-to-img:", e);
  }

  // 2. pdf-to-img にフォールバック
  if (rawBuffers.length === 0) {
    const dataUrl = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
    const { pdf } = await import("pdf-to-img");
    const document = await pdf(dataUrl, { scale: 4 });
    for await (const image of document) {
      rawBuffers.push(image);
    }
    library = "pdf-to-img";
  }

  // 3. sharp で後処理（白背景 flatten + リサイズ）
  const processed = await Promise.all(
    rawBuffers.map((buf) => processImageBuffer(buf))
  );

  const elapsed = Date.now() - startTime;
  const totalSize = processed.reduce((sum, b) => sum + b.length, 0);
  console.log(
    `[pdf-to-images] ${library} | ${processed.length} pages | ${elapsed}ms | ${(totalSize / 1024).toFixed(1)} KB total`
  );

  return processed;
}
