import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-neutral-50">読み込み中...</div>}>
      <LoginForm />
    </Suspense>
  );
}
