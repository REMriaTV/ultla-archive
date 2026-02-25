import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * マイページ配下では認証必須。サイドバーはルートの LoggedInSidebarLayout で表示されるためここでは出さない。
 */
export default async function MypageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <div className="px-6 py-6">{children}</div>;
}
