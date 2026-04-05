-- サイドバー（マイページ等のメニュー）表示を、トップのシリーズ棚表示と独立させる
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS show_in_sidebar boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.programs.show_on_front IS 'トップページのシリーズ棚・トップ棚順に載せるか';
COMMENT ON COLUMN public.programs.show_in_sidebar IS 'マイページ等のサイドバー「コンテンツ」メニューにプログラム名を出すか';
