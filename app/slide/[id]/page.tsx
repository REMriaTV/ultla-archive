import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MylistButton, MylistLoginPrompt } from "@/components/MylistButton";
import { NoRightClick } from "@/components/NoRightClick";
import { SlideImageViewer } from "@/components/SlideImageViewer";
import { getAccessContext, canViewSlide, hasFullAccessToSlide } from "@/lib/access";

interface SlideDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SlideDetailPage({ params }: SlideDetailPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const accessCtx = await getAccessContext(supabase, supabaseAdmin ?? null);

  const slideClient = accessCtx.isAdmin && supabaseAdmin ? supabaseAdmin : supabase;
  const { data: slide, error } = await slideClient
    .from("slides")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !slide) {
    notFound();
  }

  if (!canViewSlide(slide, accessCtx)) {
    notFound();
  }

  const plan = accessCtx.plan;
  const isPremium = plan === "premium" || plan === "advance";
  const isAdmin = accessCtx.isAdmin;

  // 管理者・有料プラン（advance/premium）・招待コード紐づき、または plan+content_tier で全ページ可
  const hasFullAccess =
    isAdmin ||
    isPremium ||
    hasFullAccessToSlide(slide, accessCtx);

  const freePreviewPageCount = hasFullAccess ? (slide.page_count ?? 999) : 4;

  // 画像ベース表示: page_image_urls があれば画像ビューワー、なければ PDF iframe
  const pageImageUrls = Array.isArray(slide.page_image_urls)
    ? slide.page_image_urls.filter((u: unknown): u is string => typeof u === "string")
    : [];
  const hasPageImages = pageImageUrls.length > 0;
  const pageCount = slide.page_count ?? pageImageUrls.length;

  let isInMylist = false;
  if (accessCtx.userId) {
    const { data: row } = await supabase
      .from("user_slides")
      .select("slide_id")
      .eq("user_id", accessCtx.userId)
      .eq("slide_id", id)
      .maybeSingle();
    isInMylist = !!row;
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header
        className="border-b"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="mx-auto max-w-4xl px-6 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--fg-muted)" }}
          >
            <span aria-hidden>←</span>
            Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* メタデータ */}
        <div className="mb-6">
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--fg)" }}
          >
            {slide.title}
          </h1>
          {slide.year && (
            <p className="mt-1.5 text-sm" style={{ color: "var(--fg-muted)" }}>
              {slide.year}年
            </p>
          )}
          {Array.isArray(slide.keyword_tags) && slide.keyword_tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {slide.keyword_tags.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-md px-3 py-1.5 text-sm"
                  style={{
                    background: "var(--card-hover)",
                    color: "var(--fg)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            {accessCtx.userId ? (
              <MylistButton slideId={id} initialInMylist={isInMylist} />
            ) : (
              <MylistLoginPrompt />
            )}
          </div>
        </div>

        {/* 利用規約: ダウンロード禁止の明示 */}
        <p className="mb-4 text-center text-xs" style={{ color: "var(--fg-muted)" }}>
          ※掲載コンテンツの無断ダウンロード・二次利用は禁止されています。
        </p>

        {/* ビューワー: 画像ベース優先、なければPDF iframe */}
        <NoRightClick className="relative">
          <section>
          <h2 className="sr-only">スライドビューワー</h2>
          {hasPageImages ? (
            <SlideImageViewer
              pageImageUrls={pageImageUrls}
              pageCount={pageCount}
              freePreviewPageCount={freePreviewPageCount}
              title={slide.title}
              slideId={id}
              pdfUrl={slide.pdf_url}
              isPremium={isPremium}
              isAdmin={isAdmin}
              isLoggedIn={!!accessCtx.userId}
            />
          ) : slide.pdf_url ? (
            <div
              className="relative overflow-hidden rounded-lg border shadow-sm"
              style={{
                borderColor: "var(--border)",
                background: "var(--card-hover)",
              }}
            >
              {isAdmin && (
                <div className="flex justify-end p-2" style={{ background: "var(--card-hover)" }}>
                  <a
                    href={`/api/slides/${id}/download`}
                    download
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                  >
                    PDF をダウンロード
                  </a>
                </div>
              )}
              <div className="aspect-video w-full">
                <iframe
                  src={slide.pdf_url}
                  title={slide.title}
                  className="h-full w-full border-0"
                />
              </div>
              {/* PDF表示時はオーバーレイのみ（iframe内スクロールは制限不可）。ログイン済みなら招待コード案内に */}
              <div
                className="slide-pdf-overlay absolute bottom-0 left-0 right-0 flex min-h-[70%] flex-col items-center justify-end pb-8 pt-24"
                aria-hidden
              >
                <p
                  className="mb-4 max-w-md text-center text-sm"
                  style={{ color: "var(--fg)" }}
                >
                  {accessCtx.userId
                    ? `最初の${freePreviewPageCount}ページは無料で閲覧できます。全ページを閲覧するには、マイページの「招待コード」からコードを入力してください。招待コードには有効期限があります。`
                    : `最初の${freePreviewPageCount}ページは無料で閲覧できます。全ページを閲覧するにはログインのうえ、招待コードを入力してください。`}
                </p>
                <Link
                  href={accessCtx.userId ? "/mypage/invite-codes" : "/login"}
                  className="rounded-lg px-6 py-3 text-sm font-medium transition-colors"
                  style={{
                    background: "var(--btn-primary-bg)",
                    color: "var(--btn-primary-fg)",
                  }}
                >
                  {accessCtx.userId ? "招待コードを入力" : "ログイン"}
                </Link>
                {isAdmin && (
                  <p className="mt-4 max-w-md text-center text-xs" style={{ color: "var(--fg-muted)" }}>
                    管理者はオリジナルPDFをダウンロードできます。
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div
              className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border py-16 text-center"
              style={{
                borderColor: "var(--border)",
                background: "var(--card-hover)",
              }}
            >
              <p style={{ color: "var(--fg-muted)" }}>
                スライド画像またはPDFが登録されていません
              </p>
            </div>
          )}
        </section>
        </NoRightClick>

        <div className="mt-12 flex justify-center border-t pt-8" style={{ borderColor: "var(--border)" }}>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--fg-muted)" }}
          >
            <span aria-hidden>←</span>
            トップへ戻る
          </Link>
        </div>
      </main>
    </div>
  );
}
