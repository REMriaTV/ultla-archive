"use client";

import type { Program } from "@/lib/types";

interface ProgramCardProps {
  program: Program;
}

export function ProgramCard({ program }: ProgramCardProps) {
  return (
    <article
      className="group cursor-pointer rounded-lg border border-neutral-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-neutral-400 hover:shadow-md"
      role="button"
      tabIndex={0}
      onClick={() => {
        // 将来的に詳細ページへ遷移
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          // 将来的に詳細ページへ遷移
        }
      }}
    >
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-medium text-neutral-500 tabular-nums">
          {program.started_year ?? "—"}
        </span>
        <h2 className="text-xl font-semibold text-neutral-900 group-hover:text-neutral-700">
          {program.name}
        </h2>
      </div>
      {program.description && (
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          {program.description}
        </p>
      )}
    </article>
  );
}
