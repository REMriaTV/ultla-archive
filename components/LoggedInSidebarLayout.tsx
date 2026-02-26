"use client";

import { MypageSidebar } from "@/components/MypageSidebar";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * デスクトップでは常に左サイドバーを表示し、その横にコンテンツを表示。
 * サイドバーはビューポート高さいっぱい（ヘッダー下まで）。フッターはコンテンツ側の末尾のみに表示。
 */
export function LoggedInSidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 w-full" style={{ background: "var(--bg)" }}>
      {/* ヘッダー下から画面最下部まで。中身だけ縦スクロール・スクロールバー非表示 */}
      <div
        className="sticky top-14 hidden shrink-0 self-start overflow-hidden md:block"
        style={{ height: "calc(100vh - 3.5rem)", maxHeight: "calc(100vh - 3.5rem)" }}
      >
        <MypageSidebar />
      </div>
      {/* コンテンツ＋フッターを縦スクロール（フッターはコンテンツの末尾のみ） */}
      <div className="min-h-0 min-w-0 flex-1 flex flex-col overflow-y-auto">
        <div className="min-h-0 flex-1 flex w-full justify-center">
          {children}
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
