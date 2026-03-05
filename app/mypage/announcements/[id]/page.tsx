import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementMarkdown } from "@/components/AnnouncementMarkdown";

export const dynamic = "force-dynamic";

type Announcement = {
  id: string;
  title: string;
  body: string;
  published_at: string;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MypageAnnouncementDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Announcements fetch error:", error);
    notFound();
  }

  const list = Array.isArray(data) ? (data as Announcement[]) : [];
  if (list.length === 0) {
    notFound();
  }

  let currentIndex = 0;

  if (id !== "latest") {
    currentIndex = list.findIndex((a) => a.id === id);
    if (currentIndex === -1) {
      notFound();
    }
  }

  const current = list[currentIndex];
  const newer = currentIndex > 0 ? list[currentIndex - 1] : null;
  const older = currentIndex < list.length - 1 ? list[currentIndex + 1] : null;

  const publishedDate = current.published_at
    ? new Date(current.published_at).toLocaleDateString("ja-JP")
    : "";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/mypage/announcements"
          className="text-sm hover:opacity-80"
          style={{ color: "var(--fg-muted)" }}
        >
          お知らせ一覧へ
        </Link>
      </div>

      <article
        className="rounded-xl border px-5 py-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <header className="mb-3">
          <h1 className="text-lg font-semibold" style={{ color: "var(--fg)" }}>
            {current.title}
          </h1>
          {publishedDate && (
            <p className="mt-1 text-xs" style={{ color: "var(--fg-muted)" }}>
              {publishedDate} 公開
            </p>
          )}
        </header>
        <div className="text-sm" style={{ color: "var(--fg-muted)" }}>
          <AnnouncementMarkdown body={current.body} />
        </div>
      </article>

      <nav className="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          {newer && (
            <Link
              href={`/mypage/announcements/${encodeURIComponent(newer.id)}`}
              className="hover:opacity-80"
              style={{ color: "var(--fg-muted)" }}
            >
              ← 前のお知らせ
            </Link>
          )}
        </div>
        <div className="ml-auto">
          {older && (
            <Link
              href={`/mypage/announcements/${encodeURIComponent(older.id)}`}
              className="hover:opacity-80"
              style={{ color: "var(--fg-muted)" }}
            >
              次のお知らせ →
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}

