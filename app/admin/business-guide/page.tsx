import { readFile } from "fs/promises";
import path from "path";
import Link from "next/link";

/** **text** を <strong> に変換 */
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.includes("**")) {
    const idx = remaining.indexOf("**");
    const end = remaining.indexOf("**", idx + 2);
    const before = remaining.slice(0, idx);
    const mid = end >= 0 ? remaining.slice(idx + 2, end) : remaining.slice(idx + 2);
    const rest = end >= 0 ? remaining.slice(end + 2) : "";
    parts.push(<span key={key++}>{before}</span>);
    parts.push(<strong key={key++}>{mid}</strong>);
    remaining = rest;
  }
  parts.push(<span key={key++}>{remaining}</span>);
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export default async function AdminBusinessGuidePage() {
  const filePath = path.join(
    process.cwd(),
    "docs/roadmap/SPACE_ARCHIVE_ビジネスシミュレーション_戦略ガイド.md"
  );
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return (
      <div className="min-h-screen w-full" style={{ background: "var(--bg)", color: "var(--fg)" }}>
        <header className="w-full border-b" style={{ borderColor: "var(--border)", background: "var(--bg-header)" }}>
          <div className="mx-auto w-full max-w-4xl px-6 py-6">
            <div className="flex items-center justify-between gap-4">
              <Link href="/admin" className="shrink-0 text-sm font-medium hover:opacity-80" style={{ color: "var(--fg-muted)" }}>
                ← 管理画面
              </Link>
              <div className="flex min-w-0 shrink-0 items-center gap-4">
                <Link href="/admin/operations" className="shrink-0 text-sm hover:opacity-80" style={{ color: "var(--fg-muted)" }}>運用管理</Link>
                <Link href="/admin/slides" className="shrink-0 text-sm hover:opacity-80" style={{ color: "var(--fg-muted)" }}>スライド管理</Link>
                <Link href="/admin/videos" className="shrink-0 text-sm hover:opacity-80" style={{ color: "var(--fg-muted)" }}>動画管理</Link>
                <Link href="/admin/settings" className="shrink-0 text-sm hover:opacity-80" style={{ color: "var(--fg-muted)" }}>フロント設定</Link>
                <Link href="/admin/master" className="shrink-0 text-sm hover:opacity-80" style={{ color: "var(--fg-muted)" }}>マスタ管理</Link>
                <h1 className="shrink-0 text-xl font-bold" style={{ color: "var(--fg)" }}>ビジネス・戦略ガイド</h1>
              </div>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-4xl px-6 py-8">
          <p style={{ color: "var(--fg-muted)" }}>ドキュメントを読み込めませんでした。ファイルが存在するか確認してください。</p>
        </div>
      </div>
    );
  }

  const blocks = content.split(/\n\n+/);
  return (
    <div className="min-h-screen w-full" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <header className="w-full border-b" style={{ borderColor: "var(--border)", background: "var(--bg-header)" }}>
        <div className="mx-auto w-full max-w-4xl px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <Link href="/admin" className="shrink-0 text-sm font-medium hover:opacity-80" style={{ color: "var(--fg-muted)" }}>
              ← 管理画面
            </Link>
            <div className="flex min-w-0 shrink-0 items-center gap-4">
              <Link href="/admin/operations" className="shrink-0 text-sm hover:opacity-80" style={{ color: "var(--fg-muted)" }}>運用管理</Link>
              <Link href="/admin/slides" className="shrink-0 text-sm hover:opacity-80" style={{ color: "var(--fg-muted)" }}>スライド管理</Link>
              <Link href="/admin/videos" className="shrink-0 text-sm hover:opacity-80" style={{ color: "var(--fg-muted)" }}>動画管理</Link>
              <Link href="/admin/settings" className="shrink-0 text-sm hover:opacity-80" style={{ color: "var(--fg-muted)" }}>フロント設定</Link>
              <Link href="/admin/master" className="shrink-0 text-sm hover:opacity-80" style={{ color: "var(--fg-muted)" }}>マスタ管理</Link>
              <h1 className="shrink-0 text-xl font-bold" style={{ color: "var(--fg)" }}>ビジネス・戦略ガイド</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <p className="mb-6 text-sm" style={{ color: "var(--fg-muted)" }}>
          運営チーム共有用。いつでも参照して方針を揃えてください。
        </p>
        <article className="space-y-6 rounded-lg border p-6" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          {blocks.map((block, i) => {
            const trimmed = block.trim();
            if (!trimmed) return null;

            if (trimmed.startsWith("### ")) {
              return (
                <h3 key={i} className="text-lg font-semibold text-neutral-800 mt-6">
                  {formatInline(trimmed.slice(4))}
                </h3>
              );
            }
            if (trimmed.startsWith("## ")) {
              return (
                <h2
                  key={i}
                  className="text-xl font-bold text-neutral-800 mt-8 border-b border-neutral-200 pb-2"
                >
                  {formatInline(trimmed.slice(3))}
                </h2>
              );
            }
            if (trimmed.startsWith("# ")) {
              return (
                <h1 key={i} className="text-2xl font-bold text-neutral-900">
                  {formatInline(trimmed.slice(2))}
                </h1>
              );
            }
            if (trimmed.startsWith("> ")) {
              const quote = trimmed
                .split("\n")
                .map((l) => l.replace(/^> ?/, ""))
                .join(" ");
              return (
                <blockquote
                  key={i}
                  className="border-l-4 border-amber-400 pl-4 py-2 my-4 bg-amber-50/50 text-neutral-700 text-sm rounded-r"
                >
                  {formatInline(quote)}
                </blockquote>
              );
            }
            if (trimmed.startsWith("* ") || /^\s*\* /.test(trimmed)) {
              const lines = trimmed.split("\n");
              const items = lines
                .filter((l) => /^\s*\* /.test(l))
                .map((l) => l.replace(/^\s*\* ?/, "").trim());
              return (
                <ul key={i} className="list-disc pl-6 my-2 space-y-1 text-neutral-700">
                  {items.map((item, j) => (
                    <li key={j}>{formatInline(item)}</li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={i} className="text-neutral-700 leading-relaxed">
                {formatInline(trimmed)}
              </p>
            );
          })}
        </article>
      </div>
    </div>
  );
}
