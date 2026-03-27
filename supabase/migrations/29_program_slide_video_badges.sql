-- Phase 10: プログラムごとのスライド/動画バッジ設定

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS slide_badge_label TEXT,
  ADD COLUMN IF NOT EXISTS slide_badge_bg TEXT,
  ADD COLUMN IF NOT EXISTS slide_badge_text TEXT,
  ADD COLUMN IF NOT EXISTS video_badge_label TEXT,
  ADD COLUMN IF NOT EXISTS video_badge_bg TEXT,
  ADD COLUMN IF NOT EXISTS video_badge_text TEXT;

COMMENT ON COLUMN public.programs.slide_badge_label IS 'スライド棚バッジの表示名（未設定なら非表示）';
COMMENT ON COLUMN public.programs.slide_badge_bg IS 'スライド棚バッジの背景色（例: #f59e0b）';
COMMENT ON COLUMN public.programs.slide_badge_text IS 'スライド棚バッジの文字色（例: #ffffff）';
COMMENT ON COLUMN public.programs.video_badge_label IS '動画棚バッジの表示名（未設定なら非表示）';
COMMENT ON COLUMN public.programs.video_badge_bg IS '動画棚バッジの背景色（例: #f59e0b）';
COMMENT ON COLUMN public.programs.video_badge_text IS '動画棚バッジの文字色（例: #ffffff）';
