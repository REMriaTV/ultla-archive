-- フロントのシリーズ棚に表示するかをジャンルごとに切り替え
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS show_on_front BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.programs.show_on_front IS 'true のときのみフロントのシリーズ棚に表示';
