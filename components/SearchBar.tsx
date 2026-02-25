"use client";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  onKeyDown,
  placeholder = "キーワード、タグ、タイトルで検索...",
}: SearchBarProps) {
  return (
    <div className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full rounded-lg border py-3 pl-4 pr-12 focus:outline-none focus:ring-1"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
          color: "var(--fg)",
        }}
        aria-label="スライド検索"
        suppressHydrationWarning
      />
      <span
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
        style={{ color: "var(--fg-muted)" }}
        aria-hidden
      >
        🔍
      </span>
    </div>
  );
}
