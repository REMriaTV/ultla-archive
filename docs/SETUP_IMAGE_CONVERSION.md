# 画像ベース表示のセットアップ

## 方法2: 手動変換（Phase 1）

1. **マイグレーション実行**
   ```bash
   # Supabase CLI の場合
   supabase db push
   ```
   または Supabase ダッシュボードの SQL Editor で `supabase/migrations/02_add_page_images_to_slides.sql` を実行

2. **PDFを画像に変換**
   - ImageMagick: `convert input.pdf output/page_%d.png`
   - または Adobe Acrobat、オンラインツールなど

3. **Supabase Storage にアップロード**
   - バケット `slides` を作成（未作成の場合）
   - パス `{slide_id}/pages/page_1.png`, `page_2.png` ... でアップロード

4. **DBを更新**
   - `slides` テーブルの該当レコードで `page_image_urls` に画像URLの配列を設定
   - `page_count` に総ページ数を設定

---

## 方法1: 自動変換（Phase 2）

### 前提条件

1. **Supabase Storage バケット `slides` を作成**
   - ダッシュボード → Storage → New bucket → 名前: `slides`
   - Public にすると画像URLがそのまま使える（推奨）

2. **環境変数 `SUPABASE_SERVICE_ROLE_KEY` を設定**
   - `.env.local` に追加
   - Supabase ダッシュボード → Settings → API → `service_role` キーをコピー
   - ⚠️ このキーはサーバー側でのみ使用し、クライアントに露出しないこと

### 使い方

1. 管理画面にアクセス: `/admin`
2. 「画像に変換」ボタンをクリック
3. API が PDF を取得し、画像に変換して Storage にアップロード
4. `slides` テーブルが自動更新される

### ストレージパス

- 変換後の画像: `slides/{slide_id}/pages/page_1.png`, `page_2.png`, ...

### トラブルシューティング

- **「SUPABASE_SERVICE_ROLE_KEY required」**: `.env.local` にキーを設定し、サーバーを再起動
- **「Failed to upload page image」**: Storage バケット `slides` が存在するか確認。RLS ポリシーで `service_role` は全操作可能
- **「Failed to fetch PDF」**: `pdf_url` が有効か、CORS が許可されているか確認
