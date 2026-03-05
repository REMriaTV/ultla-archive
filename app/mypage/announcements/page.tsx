import { AnnouncementsList } from "./AnnouncementsList";

export const dynamic = "force-dynamic";

export default function MypageAnnouncementsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold" style={{ color: "var(--fg)" }}>
        お知らせ
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--fg-muted)" }}>
        最新のお知らせを公開日時の新しい順で表示しています。タイトルをクリックすると詳細ページが開きます。
      </p>
      <AnnouncementsList />
    </div>
  );
}
