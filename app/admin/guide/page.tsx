import Link from "next/link";

export default function AdminGuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8 space-y-8" style={{ color: "var(--fg)" }}>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>
          SPACE ARCHIVE 管理者ガイド
        </h1>
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          このページは、スライドの公開レベルと招待コードの動き方を管理者目線で整理したメモです。
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm transition-colors hover:opacity-80"
          style={{ color: "var(--fg-muted)" }}
        >
          <span aria-hidden>←</span>
          管理画面に戻る
        </Link>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold" style={{ color: "var(--fg)" }}>1. 役割と見え方</h2>
        <p className="text-sm" style={{ color: "var(--fg)" }}>
          SPACE ARCHIVE では、ユーザーの「見え方」は次の3つで決まります。
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm" style={{ color: "var(--fg)" }}>
          <li>ログインしていない人（一般公開のチラ見せ用）</li>
          <li>ログイン済みだが招待コードを持っていない人</li>
          <li>招待コードを持っている人（セミナー参加教員など）</li>
        </ul>
        <p className="text-sm" style={{ color: "var(--fg)" }}>
          さらに、一部ユーザーは Supabase の{" "}
          <code className="rounded px-1 py-0.5 text-xs" style={{ background: "var(--card-hover)", color: "var(--fg)" }}>
            profiles.is_admin = true
          </code>
          にすることで「管理者（管理画面アクセス可）」になります。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold" style={{ color: "var(--fg)" }}>
          2. スライドの公開レベル（visibility）
        </h2>
        <p className="text-sm" style={{ color: "var(--fg)" }}>
          各スライドには <code className="rounded px-1 py-0.5 text-xs" style={{ background: "var(--card-hover)", color: "var(--fg)" }}>visibility</code>{" "}
          という公開レベルがあります。
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm" style={{ color: "var(--fg)" }}>
          <li>
            <span className="font-semibold">free（公開）</span>
            <br />
            未ログインでも一覧に表示され、詳細ページで最初の
            <strong>4ページまで</strong>
            閲覧できます。
          </li>
          <li>
            <span className="font-semibold">invite_only（コード必須）</span>
            <br />
            招待コードを持つユーザーだけが一覧に表示され、詳細ページで全ページ閲覧できます。
          </li>
          <li>
            <span className="font-semibold">private（非公開）</span>
            <br />
            管理者のみ閲覧可能。セミナー準備中の資料や内部メモ用です。
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold" style={{ color: "var(--fg)" }}>
          3. 招待コードの役割
        </h2>
        <p className="text-sm" style={{ color: "var(--fg)" }}>
          招待コードは「スライドの束（コレクション）へのフルアクセス権」です。
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm" style={{ color: "var(--fg)" }}>
          <li>招待コードごとに「紐づけスライド」をチェックで選択します。</li>
          <li>ユーザーがコードを入力すると、そのコードに紐づくスライドは「全ページ」閲覧可能になります。</li>
          <li>同じスライドを複数のコード（例: ULTLA 全体 / 食育セミナー用）に紐づけることもできます。</li>
        </ul>
        <p className="text-sm" style={{ color: "var(--fg)" }}>
          現在、招待コードは入力から一定期間（例: 1ヶ月）有効となる想定です。期限のルールは今後運用しながら調整します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold" style={{ color: "var(--fg)" }}>
          4. 実際の見え方（アルゴリズム）
        </h2>
        <p className="text-sm" style={{ color: "var(--fg)" }}>
          ざっくり言うと「招待コードがあるか／スライドがどのコードに紐づいているか」で、全ページか4ページまでかが決まります。
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm" style={{ color: "var(--fg)" }}>
          <li>
            <span className="font-semibold">A. 招待コードなしの人</span>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>visibility = free のスライドだけ一覧に出る</li>
              <li>それらは詳細ページで最初の 4 ページまで閲覧可</li>
              <li>invite_only / private のスライドは一覧に出ない</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold">
              B. 招待コードあり（有効期限内）の人
            </span>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                そのコードに
                <strong>紐づいたスライドは visibility に関係なく「全ページ」閲覧可</strong>
                （free でも invite_only でも）
              </li>
              <li>
                紐づいていない free のスライドは、A と同じく「4ページまで」のチラ見せ
              </li>
            </ul>
          </li>
          <li>
            <span className="font-semibold">C. 管理者（profiles.is_admin = true）</span>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>/admin 以下の管理画面にアクセス可能</li>
              <li>全てのスライドを閲覧・編集・削除可能</li>
            </ul>
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold" style={{ color: "var(--fg)" }}>
          5. 典型的な使い方パターン
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm" style={{ color: "var(--fg)" }}>
          <li>
            <span className="font-semibold">食育セミナー参加教員向け</span>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>食育用スライドを作成（visibility = free でも invite_only でも可）</li>
              <li>招待コード <code className="rounded px-1 py-0.5 text-xs" style={{ background: "var(--card-hover)", color: "var(--fg)" }}>shoku-iku-hayama</code>{" "}
                を作成し、対象スライドにチェック</li>
              <li>先生には「ログイン → 招待コード入力」で全ページ閲覧してもらう</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold">完全公開してよい紹介スライド</span>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>visibility = free にしておく</li>
              <li>招待コードがない一般ユーザーにも、4ページまで雰囲気を伝えられる</li>
            </ul>
          </li>
          <li>
            <span className="font-semibold">内部用・未公開資料</span>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>visibility = private にしておく</li>
              <li>管理者以外のユーザーには一覧にも出ない</li>
            </ul>
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold" style={{ color: "var(--fg)" }}>
          6. 管理者アカウントについて
        </h2>
        <p className="text-sm" style={{ color: "var(--fg)" }}>
          管理者かどうかは Supabase の <code className="rounded px-1 py-0.5 text-xs" style={{ background: "var(--card-hover)", color: "var(--fg)" }}>profiles</code>{" "}
          テーブルの <code className="rounded px-1 py-0.5 text-xs" style={{ background: "var(--card-hover)", color: "var(--fg)" }}>is_admin</code>{" "}
          で管理します。
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm" style={{ color: "var(--fg)" }}>
          <li>新しい管理者を追加したい場合は、Supabase の Table Editor で対象ユーザーの is_admin を true にします。</li>
          <li>管理者でないユーザーが /admin 以下にアクセスすると 404 になります。</li>
        </ul>
      </section>
    </main>
  );
}

