"use client";

import Link from "next/link";

interface SlideImageViewerProps {
  pageImageUrls: string[];
  pageCount: number;
  freePreviewPageCount?: number;
  title: string;
  slideId?: string;
  pdfUrl?: string | null;
  isPremium?: boolean;
  isAdmin?: boolean;
  isLoggedIn?: boolean;
}

export function SlideImageViewer({
  pageImageUrls,
  pageCount,
  freePreviewPageCount = 4,
  title,
  slideId,
  pdfUrl,
  isPremium = false,
  isAdmin = false,
  isLoggedIn = false,
}: SlideImageViewerProps) {
  const hasRestrictedPages = pageImageUrls.length > freePreviewPageCount;
  const canDownloadPdf = isPremium || isAdmin;

  return (
    <div
      className="space-y-4"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* プレミアムまたは管理者: PDF ダウンロードボタン */}
      {slideId && pdfUrl && canDownloadPdf && (
        <div className="flex flex-col items-end gap-1">
          <a
            href={`/api/slides/${slideId}/download`}
            download
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            PDF をダウンロード
          </a>
          {isPremium && (
            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
              ※プレミアムプラン（有料）限定の機能です
            </p>
          )}
        </div>
      )}

      {pageImageUrls.map((url, index) => {
        const isFreePage = index < freePreviewPageCount;
        const isRestricted = !isFreePage && hasRestrictedPages;

        return (
          <div
            key={`${url}-${index}`}
            className="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
          >
            <div className="relative aspect-[4/3] w-full max-w-3xl mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${title} - ページ ${index + 1}`}
                className={`h-full w-full object-contain select-none ${
                  isRestricted ? "blur" : ""
                }`}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
              />

              {/* 制限ページ用オーバーレイ（4枚目以降の案内。透かしつつ案内文は濃い色で読みやすく） */}
              {isRestricted && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-lg"
                  style={{ background: "rgba(255, 255, 255, 0.68)" }}
                  aria-hidden
                >
                  <p className="mb-4 max-w-sm text-center text-sm font-medium text-neutral-900 drop-shadow-sm">
                    このスライドの全{pageCount}
                    ページを閲覧するにはログインが必要です。ログイン後、招待コードを入力すると全ページ閲覧できます。
                  </p>
                  <Link
                    href="/login"
                    className="rounded-lg px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{
                      background: "var(--btn-primary-bg)",
                      color: "var(--btn-primary-fg)",
                    }}
                  >
                    ログイン
                  </Link>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
