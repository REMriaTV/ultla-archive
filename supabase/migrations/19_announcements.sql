-- お知らせテーブル（トップ・ログイン・マイページで表示）

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.announcements IS 'お知らせ。管理画面で作成・編集し、トップ・ログイン・マイページで表示';
COMMENT ON COLUMN public.announcements.is_published IS 'true のときのみ一般ユーザーに表示';
COMMENT ON COLUMN public.announcements.published_at IS '公開日時。並び替え・「公開」にしたときの時刻更新用';

CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON public.announcements (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_is_published ON public.announcements (is_published) WHERE is_published = true;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 一般: 公開中のみ SELECT 可
CREATE POLICY "Public can read published announcements"
  ON public.announcements FOR SELECT
  USING (is_published = true);

-- 管理者: 全件 SELECT / INSERT / UPDATE / DELETE
CREATE POLICY "Admins can read all announcements"
  ON public.announcements FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can insert announcements"
  ON public.announcements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can update announcements"
  ON public.announcements FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can delete announcements"
  ON public.announcements FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
