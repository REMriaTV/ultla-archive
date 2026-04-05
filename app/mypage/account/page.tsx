import { redirect } from "next/navigation";

/** 旧URL。アカウント情報は「アカウント（設定）」に統合 */
export default function MypageAccountPage() {
  redirect("/mypage/settings");
}
