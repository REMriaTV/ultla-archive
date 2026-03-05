"use client";

import type React from "react";

type Block =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "blockquote"; text: string }
  | { type: "hr" };

function renderInline(text: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (true) {
    const start = rest.indexOf("**");
    if (start === -1) {
      if (rest) nodes.push(<span key={key++}>{rest}</span>);
      break;
    }
    const end = rest.indexOf("**", start + 2);
    if (end === -1) {
      nodes.push(<span key={key++}>{rest}</span>);
      break;
    }
    const before = rest.slice(0, start);
    const bold = rest.slice(start + 2, end);
    if (before) nodes.push(<span key={key++}>{before}</span>);
    nodes.push(
      <strong key={key++}>
        {bold}
      </strong>
    );
    rest = rest.slice(end + 2);
  }
  if (nodes.length === 1) return nodes[0];
  return <>{nodes}</>;
}

function parseMarkdown(text: string): Block[] {
  const lines = text.split(/\r?\n/);
  const blocks: Block[] = [];
  let currentList: string[] | null = null;
  let currentQuote: string[] | null = null;

  const flushList = () => {
    if (currentList && currentList.length > 0) {
      blocks.push({ type: "ul", items: currentList });
    }
    currentList = null;
  };

  const flushQuote = () => {
    if (currentQuote && currentQuote.length > 0) {
      blocks.push({ type: "blockquote", text: currentQuote.join(" ") });
    }
    currentQuote = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/u, "");
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      flushQuote();
      continue;
    }
    if (trimmed === "---") {
      flushList();
      flushQuote();
      blocks.push({ type: "hr" });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      flushQuote();
      blocks.push({ type: "h2", text: trimmed.slice(3) });
      continue;
    }
    if (trimmed.startsWith(">")) {
      flushList();
      const content = trimmed.replace(/^>\s?/, "");
      if (!currentQuote) currentQuote = [];
      currentQuote.push(content);
      continue;
    }
    if (/^-\s+/.test(trimmed)) {
      flushQuote();
      const item = trimmed.replace(/^-+\s+/, "");
      if (!currentList) currentList = [];
      currentList.push(item);
      continue;
    }
    // default: paragraph line
    flushList();
    flushQuote();
    blocks.push({ type: "p", text: line });
  }

  flushList();
  flushQuote();

  return blocks;
}

export function AnnouncementMarkdown({ body }: { body: string }) {
  const blocks = parseMarkdown(body);
  if (blocks.length === 0) {
    return null;
  }
  return (
    <div className="announcement-markdown text-sm">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "h2":
            return (
              <h2 key={idx}>
                {renderInline(block.text)}
              </h2>
            );
          case "p":
            return (
              <p key={idx}>
                {renderInline(block.text)}
              </p>
            );
          case "ul":
            return (
              <ul key={idx}>
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case "blockquote":
            return (
              <blockquote key={idx}>
                {renderInline(block.text)}
              </blockquote>
            );
          case "hr":
            return <hr key={idx} />;
        }
      })}
    </div>
  );
}

export function stripMarkdownForPreview(text: string): string {
  return text
    .replace(/^##\s+/gm, "")
    .replace(/^-\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

