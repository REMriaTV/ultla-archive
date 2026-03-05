# Stripe サブスク連携 詳細設定ガイド（Phase 3）

このドキュメントでは、Stripe ダッシュボードでの設定と `.env.local` の設定を**順番に**説明します。

---

## 前提

- Stripe アカウントを持っていること（未登録なら https://dashboard.stripe.com/register で作成）
- 本番とテストで手順は同じ。**テストモード**（画面上部の「テストモード」がオン）で先に試すことを推奨

---

## 1. API キーを取得する（STRIPE_SECRET_KEY）

1. https://dashboard.stripe.com にログイン
2. 左上の「開発者」をクリック
3. 左メニューから **「API キー」** を選択
4. **「シークレットキー」** の「表示」をクリックしてキーを表示
   - テストモードなら `sk_test_...` で始まるキー
   - 本番なら「本番モード」に切り替えて `sk_live_...` を取得
5. このキーをコピーし、あとで `.env.local` の `STRIPE_SECRET_KEY` に貼り付けます（まだファイルは作らなくてOK）

---

## 2. PRO 用のサブスク価格を作成（STRIPE_PRICE_ID_PRO）

1. ダッシュボード左メニュー **「商品カタログ」** → **「商品」**
2. **「+ 商品を追加」** をクリック
3. 次のように入力：
   - **名前**: `PRO プラン`（または任意の名前）
   - **説明**: （任意）例: 月額サブスク・PROレベルコンテンツまで閲覧可
   - **画像**: （任意）
4. **「価格を追加」** または「価格」セクションで：
   - **料金のタイプ**: 「標準の料金」を選択
   - **料金**: 例として **500** 円（または 300〜900 円の希望額）
   - **請求の頻度**: **毎月**
   - **通貨**: **jpy**
5. **「商品を保存」** をクリック
6. 作成した**価格**の行をクリックするか、商品詳細で「価格」を開く
7. **「Price ID」** をコピー（`price_xxxxxxxxxxxxx` の形式）
8. この ID を `.env.local` の **`STRIPE_PRICE_ID_PRO`** に使います

---

## 3. ADVANCE 用のサブスク価格を作成（STRIPE_PRICE_ID_ADVANCE）

1. 同じく **「商品カタログ」** → **「商品」** → **「+ 商品を追加」**
2. 例：
   - **名前**: `ADVANCE プラン`
   - **説明**: （任意）全コンテンツ一括・ダウンロード可
3. **価格**を追加：
   - **料金**: 例 **3000** 円（または希望の月額）
   - **請求の頻度**: **毎月**
   - **通貨**: **jpy**
4. 保存後、その価格の **Price ID**（`price_...`）をコピー
5. この ID を **`STRIPE_PRICE_ID_ADVANCE`** に使います

---

## 4. Webhook エンドポイントを追加（STRIPE_WEBHOOK_SECRET）

Webhook は「Stripe からあなたのサーバーへ、サブスクの作成・更新・解約を通知する仕組み」です。

### 4-1. 本番・ステージング（Vercel などデプロイ済みのとき）

1. ダッシュボード **「開発者」** → **「Webhook」**
2. **「エンドポイントを追加」** をクリック
3. 次のように入力：
   - **エンドポイント URL**:  
     `https://<あなたのドメイン>/api/stripe/webhook`  
     例: `https://your-app.vercel.app/api/stripe/webhook`
   - **リッスンするイベント**: 「イベントを選択」から以下を**追加**：
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
4. **「エンドポイントを追加」** をクリック
5. 追加した Webhook をクリックし、**「署名シークレット」**の「表示」→ コピー（`whsec_...`）
6. この値を **`STRIPE_WEBHOOK_SECRET`** に使います

### 4-2. ローカル開発（自分のPCで試すとき）

本番 URL がないため、Stripe CLI で「ローカル → Stripe の Webhook 受信」を中継します。

1. **Stripe CLI のインストール**
   - Mac: `brew install stripe/stripe-cli/stripe`
   - または https://stripe.com/docs/stripe-cli からインストール
2. ターミナルでログイン:  
   `stripe login`
3. リッスン開始:  
   `stripe listen --forward-to localhost:3000/api/stripe/webhook`
4. 表示される **「Webhook 署名シークレット」**（`whsec_...`）をコピー
5. この値を `.env.local` の **`STRIPE_WEBHOOK_SECRET`** に設定
6. このターミナルは**起動したまま**にし、別ターミナルで `npm run dev` を実行してテスト

---

## 5. .env.local に環境変数を設定

プロジェクトの**ルート**（`package.json` がある場所）に `.env.local` を作成・編集します。

### 5-1. 最小構成（テスト用）

```bash
# Stripe（テストモードのキー）
STRIPE_SECRET_KEY=sk_test_ここにシークレットキーを貼り付け
STRIPE_PRICE_ID_PRO=price_ここにPROのPrice_IDを貼り付け
STRIPE_PRICE_ID_ADVANCE=price_ここにADVANCEのPrice_IDを貼り付け
STRIPE_WEBHOOK_SECRET=whsec_ここにWebhookの署名シークレットを貼り付け
```

### 5-2. 本番・Vercel で使う場合

- **STRIPE_SECRET_KEY**: 本番モードのシークレットキー（`sk_live_...`）
- **STRIPE_PRICE_ID_PRO** / **STRIPE_PRICE_ID_ADVANCE**: 本番モードで作成した価格の Price ID（本番モードで同じ手順で商品・価格を作成）
- **STRIPE_WEBHOOK_SECRET**: 本番用 Webhook の署名シークレット（上記 4-1 で取得）
- **NEXT_PUBLIC_APP_URL**: アプリの公開 URL（例: `https://your-app.vercel.app`）。チェックアウト後のリダイレクト先に使います

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_ADVANCE=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 5-3. 注意

- `.env.local` は **Git にコミットしない**（`.gitignore` に含まれている想定）
- Vercel にデプロイする場合は、Vercel の「プロジェクト → Settings → Environment Variables」で上記の変数を**同じ名前**で登録する

---

## 6. 設定の確認チェックリスト

| 項目 | 確認 |
|------|------|
| Stripe ダッシュボードで「PRO」「ADVANCE」用の**商品＋月額価格**を2つ作成した | ☐ |
| それぞれの **Price ID**（`price_...`）をコピーした | ☐ |
| **STRIPE_SECRET_KEY** を API キーからコピーした | ☐ |
| **Webhook** を追加し、`customer.subscription.created/updated/deleted` を選択した | ☐ |
| Webhook の **署名シークレット**（`whsec_...`）をコピーした | ☐ |
| `.env.local` に 4 つ（本番なら + NEXT_PUBLIC_APP_URL）を書いた | ☐ |
| 開発サーバーを**再起動**した（`npm run dev` を止めて再度実行） | ☐ |

---

## 7. 動作確認のしかた

1. `npm run dev` でアプリを起動
2. ログインして **マイページ** → **「プラン登録」**
3. **「PRO プランに登録」** をクリック
4. Stripe のチェックアウトページに飛べば OK（テストカードは `4242 4242 4242 4242` などが使えます）
5. 支払い完了後、`/mypage/subscription?success=1` に戻り、ヘッダーやアカウント情報のプランが **PRO** になっていれば Webhook も動作しています

エラーが出る場合は、ブラウザの開発者ツール（Network）と、ターミナルのログ、Stripe ダッシュボードの「開発者」→「Webhook」のログで、どの段階で失敗しているか確認してください。

---

## 8. 本番運用で気をつけること

Stripe で本番課金を始める前に、以下を押さえておくとスムーズです。

### 審査

- 教育コンテンツの月額サブスクは、審査で問題になることはほとんどありません。
- **サイトで「何を売っているか」が明確にわかる状態**で申請すること。サービス説明ページ、利用規約、特商法に基づく表記を事前に用意しておくと審査が通りやすいです。

### インボイス制度（適格請求書）

- ADVANCE（月額数千円）の利用者が法人の場合、適格請求書の発行を求められることがあります。
- **Stripe Invoice** で対応可能です。売上が出てきた段階で、Stripe ダッシュボードの「請求」や Invoicing 機能を検討すれば十分です。最初から必須ではありません。

### 手数料

- Stripe の手数料はおおむね **3.6%**。月額 300 円なら約 11 円、数千円規模でも他社と大きな差はありません。この規模で手数料を理由に別ツールに乗り換えるメリットはほぼありません。
