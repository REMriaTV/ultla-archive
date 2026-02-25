-- マイリスト: ユーザーが保存したスライド
-- 1ユーザー・1スライド1行（重複登録不可）
-- ※ slides.id が BIGINT のため slide_id も BIGINT（UUID の場合は UUID に変更）

CREATE TABLE IF NOT EXISTS public.user_slides (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slide_id BIGINT NOT NULL REFERENCES public.slides(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, slide_id)
);

CREATE INDEX IF NOT EXISTS idx_user_slides_user_id ON public.user_slides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_slides_slide_id ON public.user_slides(slide_id);

ALTER TABLE public.user_slides ENABLE ROW LEVEL SECURITY;

-- 自分の行のみ読み取り・追加・削除可能
CREATE POLICY "Users can read own user_slides"
  ON public.user_slides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user_slides"
  ON public.user_slides FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own user_slides"
  ON public.user_slides FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_slides IS 'マイリスト（ユーザーが保存したスライド）';
