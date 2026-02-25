import { pathToFileURL } from "node:url";
import * as path from "node:path";

/**
 * pdfjs-dist を使って PDF からテキストを抽出
 * worker は node_modules の絶対パス（file:// URL）で指定
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const workerPath = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

  const data = Uint8Array.from(pdfBuffer);
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  const textParts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join("");
    textParts.push(pageText);
  }

  await pdfDocument.destroy();
  return textParts.join("\n\n");
}
