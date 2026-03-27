-- Phase 9: プログラムごとの棚バッジ名

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS shelf_badge_label TEXT;

COMMENT ON COLUMN public.programs.shelf_badge_label IS 'シリーズ棚カードのバッジ名（例: 講演 / ABL / PBL）。未設定時は自動判定';
