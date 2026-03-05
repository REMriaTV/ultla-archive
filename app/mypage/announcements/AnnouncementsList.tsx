"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { stripMarkdownForPreview } from "@/components/AnnouncementMarkdown";

type Announcement = {
  id: string;
  title: string;
  body: string;
  published_at: string;
};

export function AnnouncementsList() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/announcements")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const arr: Announcement[] = Array.isArray(data) ? data : [];
        setList(arr);
      })
      .catch(() => {
        setList([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
        読み込み中...
      </p>
    );
  }

  if (list.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed p-8 text-center text-sm"
        style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
      >
        お知らせはありません。
      </div>
    );
  }

  const previewLength = 80;

  return (
    <ul className="space-y-3">
      {list.map((a) => {
        const plainBody = stripMarkdownForPreview(a.body);
        const preview =
          plainBody.length <= previewLength
            ? plainBody
            : plainBody.slice(0, previewLength) + "…";

        return (
          <li
            key={a.id}
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <Link
              href={`/mypage/announcements/${encodeURIComponent(a.id)}`}
              className="block px-4 py-3 hover:opacity-90 transition-opacity"
              style={{ color: "var(--fg)" }}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-medium">{a.title}</span>
                <span className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  {new Date(a.published_at).toLocaleDateString("ja-JP")}
                </span>
              </div>
              <p className="mt-1 text-sm line-clamp-2" style={{ color: "var(--fg-muted)" }}>
                {preview}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
