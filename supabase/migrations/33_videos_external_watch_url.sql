-- YouTube 以外の視聴先（例: 大学 OCW）を登録可能にする
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS external_watch_url TEXT;
ALTER TABLE public.videos ALTER COLUMN youtube_url DROP NOT NULL;

COMMENT ON COLUMN public.videos.external_watch_url IS 'YouTube 以外で視聴する URL（例: OCW）。youtube_url が無い場合はトップ棚からこの URL へ直接遷移';
COMMENT ON COLUMN public.videos.youtube_url IS 'YouTube の入力 URL。external_watch_url のみの行では NULL 可';
