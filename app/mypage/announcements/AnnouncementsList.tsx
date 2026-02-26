"use client";

import { useEffect, useState } from "react";

type Announcement = {
  id: string;
  title: string;
  body: string;
  published_at: string;
};

export function AnnouncementsList() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/announcements")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
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
        const isExpanded = expandedId === a.id;
        const preview =
          a.body.length <= previewLength
            ? a.body
            : a.body.slice(0, previewLength) + "…";

        return (
          <li
            key={a.id}
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : a.id)}
              className="w-full px-4 py-3 text-left hover:opacity-90 transition-opacity"
              style={{ color: "var(--fg)" }}
            >
              <span className="font-medium">{a.title}</span>
              <span className="ml-2 text-sm" style={{ color: "var(--fg-muted)" }}>
                {new Date(a.published_at).toLocaleDateString("ja-JP")}
              </span>
              {!isExpanded && (
                <p className="mt-1 text-sm line-clamp-2" style={{ color: "var(--fg-muted)" }}>
                  {preview}
                </p>
              )}
            </button>
            {isExpanded && (
              <div
                className="border-t px-4 py-3 text-sm whitespace-pre-wrap"
                style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
              >
                {a.body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
