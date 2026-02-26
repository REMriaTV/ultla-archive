-- お問い合わせフォームの保存用テーブル

CREATE TABLE IF NOT EXISTS public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

COMMENT ON TABLE public.inquiries IS 'お問い合わせフォームの送信内容。管理画面で一覧・既読管理用';
COMMENT ON COLUMN public.inquiries.user_id IS '送信時のログインユーザー（マイページから送信時）';
COMMENT ON COLUMN public.inquiries.read_at IS '管理者が確認した日時（未読なら NULL）';

CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON public.inquiries (created_at DESC);

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは自分の問い合わせのみ参照可（将来の「自分の送信履歴」用）
CREATE POLICY "Users can read own inquiries"
  ON public.inquiries FOR SELECT
  USING (auth.uid() = user_id);

-- 認証済みユーザーは新規投稿のみ可能
CREATE POLICY "Authenticated can insert inquiries"
  ON public.inquiries FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 管理者は全件参照・更新（既読つけ）可
CREATE POLICY "Admins can read all inquiries"
  ON public.inquiries FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can update inquiries"
  ON public.inquiries FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
