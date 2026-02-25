import { MypageSettingsClient } from "./MypageSettingsClient";

export default function MypageSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1
        className="mb-6 text-xl font-semibold"
        style={{ color: "var(--fg)" }}
      >
        設定
      </h1>
      <MypageSettingsClient />
    </div>
  );
}
