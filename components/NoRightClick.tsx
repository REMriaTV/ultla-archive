"use client";

interface NoRightClickProps {
  children: React.ReactNode;
  className?: string;
}

/** 右クリックメニューを抑制（コンテンツ保護用） */
export function NoRightClick({ children, className }: NoRightClickProps) {
  return (
    <div className={className} onContextMenu={(e) => e.preventDefault()}>
      {children}
    </div>
  );
}
