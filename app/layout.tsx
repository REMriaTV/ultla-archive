import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthHeader } from "@/components/AuthHeader";
import { HeaderSearch } from "@/components/HeaderSearch";
import { InviteGrantChecker } from "@/components/InviteGrantChecker";
import { LoggedInSidebarLayout } from "@/components/LoggedInSidebarLayout";
import { MobileSidebarMenu } from "@/components/MobileSidebarMenu";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SPACE ARCHIVE",
  description: "いつでも、どこでも、学びのレシピ",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let preferredTheme = "";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferred_theme")
        .eq("id", user.id)
        .single();
      preferredTheme = profile?.preferred_theme ?? "";
    }
  } catch {
    // 未ログインやDBエラー時はそのまま
  }

  const themeScript = `(function(){var q=new URLSearchParams(location.search).get('theme');var pref=document.body.getAttribute('data-preferred-theme')||'';if(q){document.documentElement.dataset.theme=q;}else if(pref){document.documentElement.dataset.theme=pref;}else{document.documentElement.dataset.theme='dark-light';}})();`;

  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
        data-preferred-theme={preferredTheme}
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <header
          className="sticky top-0 z-50 border-b backdrop-blur"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-header)",
          }}
        >
          <div className="header-inner mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
            <div className="flex items-center gap-2">
              <MobileSidebarMenu />
              <Link href="/" className="shrink-0 text-sm font-medium">
                トップ
              </Link>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
              <HeaderSearch />
              <AuthHeader />
            </div>
          </div>
        </header>
        <InviteGrantChecker />
        <LoggedInSidebarLayout>{children}</LoggedInSidebarLayout>
      </body>
    </html>
  );
}
