-- スライド資料を保存するための slides テーブル
-- programs テーブルへの外部キーを持つ

CREATE TABLE IF NOT EXISTS slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  keyword_tags TEXT[] DEFAULT '{}',
  image_url TEXT,
  pdf_url TEXT,
  year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 検索用インデックス（タイトル・タグ）
CREATE INDEX IF NOT EXISTS idx_slides_title ON slides USING gin(to_tsvector('simple', title));
CREATE INDEX IF NOT EXISTS idx_slides_keyword_tags ON slides USING gin(keyword_tags);
CREATE INDEX IF NOT EXISTS idx_slides_program_id ON slides(program_id);
CREATE INDEX IF NOT EXISTS idx_slides_year ON slides(year);

-- コメント
COMMENT ON TABLE slides IS '福本理恵氏の探究学習プログラムのスライド資料';
COMMENT ON COLUMN slides.keyword_tags IS '検索用タグ配列（例: りんご, バナナ, 幾何学）';
