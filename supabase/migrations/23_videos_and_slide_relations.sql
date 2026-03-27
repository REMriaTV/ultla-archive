-- Phase 4: 動画コンテンツ基盤
-- 目的:
-- 1) 動画をスライドと独立したコンテンツとして管理
-- 2) slide <-> video を多対多で紐づけ可能にする
-- 3) トップページで「動画シリーズ」表示できる下地を作る

-- ============================================================
-- 1. videos テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id BIGINT NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT,
  thumbnail_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'free'
    CHECK (visibility IN ('free', 'invite_only', 'private')),
  content_tier TEXT NOT NULL DEFAULT 'basic'
    CHECK (content_tier IN ('basic', 'pro', 'advance')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_program_id ON public.videos(program_id);
CREATE INDEX IF NOT EXISTS idx_videos_visibility ON public.videos(visibility);
CREATE INDEX IF NOT EXISTS idx_videos_content_tier ON public.videos(content_tier);
CREATE INDEX IF NOT EXISTS idx_videos_is_published ON public.videos(is_published);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON public.videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_sort_order ON public.videos(sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS uq_videos_youtube_video_id
  ON public.videos(youtube_video_id)
  WHERE youtube_video_id IS NOT NULL;

COMMENT ON TABLE public.videos IS 'YouTube動画コンテンツ本体。シリーズ(program)に属し、トップの動画棚表示に利用';
COMMENT ON COLUMN public.videos.youtube_url IS 'YouTubeの入力URL（watch/short/youtu.be を許容想定）';
COMMENT ON COLUMN public.videos.youtube_video_id IS '11文字のYouTube動画ID（URLから抽出して保存する想定）';
COMMENT ON COLUMN public.videos.visibility IS 'free=公開, invite_only=コード必須, private=管理者のみ';
COMMENT ON COLUMN public.videos.content_tier IS 'basic/pro/advance の閲覧階層';
COMMENT ON COLUMN public.videos.sort_order IS '同一program内の並び順（小さいほど先頭）';

-- 公開時刻の自動補完（true かつ published_at が未設定なら now）
CREATE OR REPLACE FUNCTION public.set_videos_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_published = true AND NEW.published_at IS NULL THEN
    NEW.published_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_videos_published_at ON public.videos;
CREATE TRIGGER trg_set_videos_published_at
BEFORE INSERT OR UPDATE ON public.videos
FOR EACH ROW
EXECUTE FUNCTION public.set_videos_published_at();

-- ============================================================
-- 2. video_slides テーブル（多対多）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.video_slides (
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  slide_id BIGINT NOT NULL REFERENCES public.slides(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (video_id, slide_id)
);

CREATE INDEX IF NOT EXISTS idx_video_slides_slide_id ON public.video_slides(slide_id);
CREATE INDEX IF NOT EXISTS idx_video_slides_video_sort ON public.video_slides(video_id, sort_order);

COMMENT ON TABLE public.video_slides IS '動画とスライドの紐づけ（多対多）。1動画に複数スライド、1スライドに複数動画を許容';
COMMENT ON COLUMN public.video_slides.sort_order IS '動画詳細での関連スライド表示順';

-- ============================================================
-- 3. RLS ポリシー
-- ============================================================
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_slides ENABLE ROW LEVEL SECURITY;

-- videos: 参照は全員、変更は認証済み
DROP POLICY IF EXISTS "videos_select" ON public.videos;
CREATE POLICY "videos_select"
  ON public.videos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "videos_insert" ON public.videos;
CREATE POLICY "videos_insert"
  ON public.videos FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "videos_update" ON public.videos;
CREATE POLICY "videos_update"
  ON public.videos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "videos_delete" ON public.videos;
CREATE POLICY "videos_delete"
  ON public.videos FOR DELETE
  TO authenticated
  USING (true);

-- video_slides: 参照は全員、変更は認証済み
DROP POLICY IF EXISTS "video_slides_select" ON public.video_slides;
CREATE POLICY "video_slides_select"
  ON public.video_slides FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "video_slides_insert" ON public.video_slides;
CREATE POLICY "video_slides_insert"
  ON public.video_slides FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "video_slides_update" ON public.video_slides;
CREATE POLICY "video_slides_update"
  ON public.video_slides FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "video_slides_delete" ON public.video_slides;
CREATE POLICY "video_slides_delete"
  ON public.video_slides FOR DELETE
  TO authenticated
  USING (true);

