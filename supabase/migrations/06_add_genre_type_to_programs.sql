-- ジャンル種別（プログラム / 組織 / 自治体）を登録・編集できるようにする
-- のちのちのジャンルタグアルゴリズム用。フロントでは表示しない。

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS genre_type TEXT NOT NULL DEFAULT 'program'
  CHECK (genre_type IN ('program', 'organization', 'municipality'));

COMMENT ON COLUMN programs.genre_type IS 'program=プログラム, organization=組織(SPACE等), municipality=自治体(鎌倉市等)';
