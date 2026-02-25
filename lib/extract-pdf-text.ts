import { pathToFileURL } from "node:url";
import * as path from "node:path";

/**
 * Node 環境では DOMMatrix が存在しないため、pdfjs-dist 用の最小限の polyfill を用意する。
 * テキスト抽出のみの用途では、実装の中身は使われないことが多い。
 */
function ensureDOMMatrixPolyfill() {
  if (typeof globalThis.DOMMatrix !== "undefined") return;
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(_init?: number[] | string) {}
    multiplySelf() {
      return this;
    }
    inverse() {
      return this;
    }
    transformPoint(_p?: { x: number; y: number }) {
      return { x: 0, y: 0 };
    }
  } as unknown as typeof DOMMatrix;
}

/**
 * pdfjs-dist を使って PDF からテキストを抽出
 * worker は node_modules の絶対パス（file:// URL）で指定
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  ensureDOMMatrixPolyfill();

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
