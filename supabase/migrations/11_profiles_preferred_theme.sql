/* マイページ用: テーマ選択を保存 */
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_theme TEXT;

COMMENT ON COLUMN public.profiles.preferred_theme IS 'ユーザーが選択したテーマID（light-water, dark-light 等）。未設定はNULL';

/* 自分のプロファイルの preferred_theme のみ更新可能（マイページのテーマ保存用） */
CREATE POLICY "Users can update own profile preferred_theme"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
