-- Phase 8: 動画メタ情報（キャプション・タグ）

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS keyword_tags TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.videos.description IS '動画棚ホバー時に表示する概要キャプション';
COMMENT ON COLUMN public.videos.keyword_tags IS '動画のキーワードタグ（検索・棚表示用）';
