# デプロイ手順（slide-archive）

## 前提
- **フロント**: Vercel（Next.js 推奨）
- **DB・認証・Storage**: Supabase（本番プロジェクトを用意）

---

## 1. Supabase 本番の準備

1. [Supabase](https://supabase.com) で本番プロジェクトを作成（未作成なら）
2. **マイグレーション適用**
   - ローカルで `supabase link` して本番を指定したあと、`supabase db push`  
   - または Supabase Dashboard → SQL Editor で `supabase/migrations/` の SQL を **01 から 22 の順**で実行
3. **Storage**
   - スライド用バケット（例: `slides`）を作成し、ポリシーを設定（必要に応じて RLS を確認）
4. **認証**
   - Email/パスワードなど必要な認証方法を有効化
   - 管理用メールを `admin_emails`（または `profiles.is_admin` の元になる仕組み）に合わせて設定

---

## 2. 環境変数（Vercel）

Vercel のプロジェクト → **Settings → Environment Variables** で以下を設定。

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase プロジェクトの URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase の anon（公開）キー |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service Role Key（管理者用・サーバー専用。**漏らさない**） |
| `ANTHROPIC_API_KEY` | 任意 | キャプション抽出（Claude）を使う場合 |
| `OPENAI_API_KEY` | 任意 | キーワード抽出（OpenAI）を使う場合 |
| `CONTACT_EMAIL` | 任意 | お問い合わせの通知先メール（未設定時は `bank@space-inc.jp`） |
| `RESEND_API_KEY` | 任意 | お問い合わせメール送信（[Resend](https://resend.com) の API キー）。未設定なら DB 保存のみ |
| `CONTACT_FROM_EMAIL` | 任意 | 送信元メール（Resend でドメイン認証したアドレス推奨。未設定時は Resend のテスト用） |
| `STRIPE_SECRET_KEY` | 任意 | Stripe のシークレットキー（本番は `sk_live_...`）。未設定ならプラン登録・決済は無効 |
| `STRIPE_PRICE_ID_PRO` | 任意 | PRO プラン用の Stripe Price ID（`price_...`） |
| `STRIPE_PRICE_ID_ADVANCE` | 任意 | ADVANCE プラン用の Stripe Price ID（`price_...`） |
| `STRIPE_WEBHOOK_SECRET` | 任意 | Stripe Webhook の署名シークレット（`whsec_...`）。未設定ならサブスク状態が DB に反映されない |
| `NEXT_PUBLIC_APP_URL` | 推奨 | アプリの公開 URL（例: `https://your-app.vercel.app`）。チェックアウト後のリダイレクトに使用 |

- 本番・プレビューどちらでも必要なものは、**Production / Preview** の両方に設定してください。
- Stripe を有効にする場合は [STRIPE_SETUP.md](docs/roadmap/STRIPE_SETUP.md) を参照し、ダッシュボードで商品・価格・Webhook を設定してから上記 4 変数を設定してください。

---

## 3. Vercel にデプロイ

1. [Vercel](https://vercel.com) で GitHub リポジトリをインポート
2. **Framework Preset**: Next.js のまま
3. 上記の環境変数を設定してから **Deploy**
4. デプロイ後、本番 URL で以下を確認
   - トップページ・プログラム一覧
   - ログイン・マイページ・マイリスト
   - 管理アカウントで「文化の再定義」などコード必須スライドが表示・詳細表示できること

---

## 4. 本番確認チェックリスト

- [ ] トップが表示される
- [ ] プログラム（シリーズ）ごとの棚が表示される
- [ ] ログイン・ログアウトができる
- [ ] マイリストの追加・一覧・削除ができる
- [ ] 招待コードで専用シリーズが表示される
- [ ] 管理アカウントで全スライド（コード必須含む）が表示・閲覧できる
- [ ] （使う場合）管理画面でスライド・プログラム・ジャンル種別の編集ができる

---

## 5. 注意事項

- **SUPABASE_SERVICE_ROLE_KEY** はサーバーだけで使い、クライアントやリポジトリに含めないこと
- 本番 Supabase の **Authentication → URL Configuration** で、Vercel の本番 URL を Redirect URL に追加すること
- マイグレーションは **01 から順番**（22 まで）を守ること（依存関係あり）。プラン・content_tier・Stripe 連携用は 20〜22。

---

## 6. カスタムドメイン（任意）

- **推奨**: 運営は株式会社SPACE。表向きは `space-archive.jp` を使用。
- **詳細手順**: [docs/DOMAIN_SETUP.md](docs/DOMAIN_SETUP.md) に「取得 → Vercel 追加 → DNS 設定 → Supabase Redirect URL」の流れをまとめてあります。

---

ここまでで約 80% 想定。残りは本番データ投入・Storage ポリシーなど必要に応じて対応してください。
