import { MypageAccountSummary } from "@/components/MypageAccountSummary";
import { MypageSettingsClient } from "./MypageSettingsClient";

export default function MypageSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-1 sm:px-0">
      <h1
        className="mb-5 text-xl font-semibold tracking-tight"
        style={{ color: "var(--fg)" }}
      >
        アカウント
      </h1>
      <div
        className="overflow-hidden rounded-xl border"
        style={{
          borderColor: "var(--border)",
          background: "var(--card)",
        }}
      >
        <MypageAccountSummary />
        <MypageSettingsClient />
      </div>
    </div>
  );
}
