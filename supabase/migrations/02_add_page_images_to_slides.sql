-- 画像ベース表示用カラム追加（方法2: 手動変換対応）
-- page_image_urls に画像URLを登録すると、PDFの代わりに画像ビューワーで表示される

ALTER TABLE slides
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS page_image_urls TEXT[] DEFAULT '{}';

COMMENT ON COLUMN slides.page_count IS 'スライドの総ページ数';
COMMENT ON COLUMN slides.page_image_urls IS '各ページの画像URL配列（Storage等）。例: [url1, url2, ...]';
