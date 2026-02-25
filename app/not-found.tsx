import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
      <h1 className="text-2xl font-bold text-neutral-900">404</h1>
      <p className="mt-2 text-neutral-600">お探しのページが見つかりませんでした</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
      >
        <span aria-hidden>←</span>
        Back to Home
      </Link>
    </div>
  );
}
