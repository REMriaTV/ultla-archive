"use client";

import { MypageSidebar } from "@/components/MypageSidebar";

/**
 * デスクトップでは常に左サイドバーを表示し、その横に children を表示する。
 * モバイルではサイドバーは非表示（後でドロワー等に対応可能）。
 */
export function LoggedInSidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      {/* ヘッダー下に揃えて固定（sticky）。ヘッダー高さ程度の top で重ならないようにする */}
      <div className="sticky top-14 hidden h-screen shrink-0 self-start md:block">
        <MypageSidebar />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
