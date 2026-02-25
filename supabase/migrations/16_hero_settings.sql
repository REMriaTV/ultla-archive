-- ヒーローカルーセル設定を site_settings に追加
-- hero_mode: 'random' = ランダムで表示, 'selected' = 選択したスライドを順に表示
-- hero_slide_count: ランダムモード時の表示枚数
-- hero_slide_ids: 選択モード時のスライドID配列（表示順）

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS hero_mode TEXT NOT NULL DEFAULT 'random'
    CHECK (hero_mode IN ('random', 'selected')),
  ADD COLUMN IF NOT EXISTS hero_slide_count INTEGER NOT NULL DEFAULT 5
    CHECK (hero_slide_count >= 1 AND hero_slide_count <= 20),
  ADD COLUMN IF NOT EXISTS hero_slide_ids JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN public.site_settings.hero_mode IS 'ヒーローカルーセル: random=ランダム, selected=選択スライドを順に表示';
COMMENT ON COLUMN public.site_settings.hero_slide_count IS 'ランダムモード時の表示枚数（1〜20）';
COMMENT ON COLUMN public.site_settings.hero_slide_ids IS '選択モード時のスライドIDの配列（例: ["uuid1","uuid2"]）';

-- 既存行を更新（新カラムのデフォルトは上で付与済み。INSERT済みの main には UPDATE で明示）
UPDATE public.site_settings
SET
  hero_mode = COALESCE(hero_mode, 'random'),
  hero_slide_count = COALESCE(hero_slide_count, 5),
  hero_slide_ids = COALESCE(hero_slide_ids, '[]'::jsonb)
WHERE id = 'main';
