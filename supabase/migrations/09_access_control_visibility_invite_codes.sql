-- ULTRA ARCHIVES アクセス制御: visibility + 招待コード紐づけ
-- Step 1: データベース設計

-- ============================================================
-- 1. slides に visibility カラム追加
-- ============================================================
ALTER TABLE public.slides
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('free', 'invite_only', 'private'));

COMMENT ON COLUMN public.slides.visibility IS 'free=未ログインでも一覧・4枚まで, invite_only=紐づくコード必須, private=管理者のみ';

-- 既存スライドは private のまま（デフォルト）

-- ============================================================
-- 2. invite_codes テーブル拡張（name, description 追加）
-- ============================================================
ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.invite_codes.name IS '招待コードの表示名（例: 葉山食育セミナー2026）';
COMMENT ON COLUMN public.invite_codes.description IS '備考';

-- 既存 ULTLA2025 に名前を付与
UPDATE public.invite_codes SET name = 'ULTLA 2025' WHERE code = 'ULTLA2025';

-- ============================================================
-- 3. invite_code_slides（コード×スライド紐づけ）新規作成
-- ============================================================
-- ※ slides.id の型に合わせる（UUID または BIGINT）。エラー時は反対の型に変更してください
CREATE TABLE IF NOT EXISTS public.invite_code_slides (
  invite_code_id UUID NOT NULL REFERENCES public.invite_codes(id) ON DELETE CASCADE,
  slide_id BIGINT NOT NULL REFERENCES public.slides(id) ON DELETE CASCADE,
  PRIMARY KEY (invite_code_id, slide_id)
);

CREATE INDEX IF NOT EXISTS idx_invite_code_slides_slide_id ON public.invite_code_slides(slide_id);

COMMENT ON TABLE public.invite_code_slides IS '招待コードごとに閲覧可能なスライドを紐づけ';

-- RLS: サーバー側（service role）のみアクセス
ALTER TABLE public.invite_code_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access"
  ON public.invite_code_slides FOR ALL
  USING (false);

-- 既存 ULTLA2025 に全スライドを紐づけ（後方互換）
INSERT INTO public.invite_code_slides (invite_code_id, slide_id)
SELECT ic.id, s.id
FROM public.invite_codes ic
CROSS JOIN public.slides s
WHERE ic.code = 'ULTLA2025'
ON CONFLICT (invite_code_id, slide_id) DO NOTHING;

-- ============================================================
-- 4. user_invite_codes（ユーザー×コード紐づけ）新規作成
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_invite_codes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code_id UUID NOT NULL REFERENCES public.invite_codes(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, invite_code_id)
);

CREATE INDEX IF NOT EXISTS idx_user_invite_codes_user_id ON public.user_invite_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_invite_codes_expires_at ON public.user_invite_codes(expires_at);

COMMENT ON TABLE public.user_invite_codes IS 'ユーザーが入力した招待コードと有効期限';
COMMENT ON COLUMN public.user_invite_codes.expires_at IS 'このユーザーがこのコードでアクセス可能な期限（入力日+1ヶ月等）';

-- RLS: ユーザーは自分のレコードのみ読み取り可能（INSERT/UPDATE/DELETE は service role 経由のみ）
ALTER TABLE public.user_invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own user_invite_codes"
  ON public.user_invite_codes FOR SELECT
  USING (auth.uid() = user_id);

-- 既存の access_granted=true ユーザーを ULTLA2025 に紐づけ（有効期限は10年後で実質無期限）
INSERT INTO public.user_invite_codes (user_id, invite_code_id, expires_at)
SELECT p.id, ic.id, NOW() + INTERVAL '10 years'
FROM public.profiles p
JOIN public.invite_codes ic ON ic.code = 'ULTLA2025'
WHERE p.access_granted = true
ON CONFLICT (user_id, invite_code_id) DO NOTHING;
