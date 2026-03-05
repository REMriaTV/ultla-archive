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
      <div className="min-h-screen bg-white px-6 py-8">
        <div className="mx-auto max-w-3xl">
          <header className="border-b border-neutral-200 pb-4">
            <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
              ← 管理画面
            </Link>
            <h1 className="mt-2 text-xl font-bold text-neutral-800">
              ビジネス・戦略ガイド（社外非公開）
            </h1>
          </header>
          <p className="mt-6 text-neutral-600">
            ドキュメントを読み込めませんでした。ファイルが存在するか確認してください。
          </p>
        </div>
      </div>
    );
  }

  const blocks = content.split(/\n\n+/);
  return (
    <div className="min-h-screen bg-white px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-neutral-200 pb-4">
          <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
            ← 管理画面
          </Link>
          <h1 className="mt-2 text-xl font-bold text-neutral-800">
            ビジネス・戦略ガイド（社外非公開）
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            運営チーム共有用。いつでも参照して方針を揃えてください。
          </p>
        </header>

        <article className="mt-8 space-y-6">
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
