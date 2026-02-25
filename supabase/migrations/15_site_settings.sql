-- サイト設定（サブタイトル・フッター文言）を管理画面から編集可能にする

CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  subtitle TEXT,
  footer_text TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.site_settings IS 'トップページのサブタイトルとフッター文言。管理画面で編集可';
COMMENT ON COLUMN public.site_settings.subtitle IS 'ヘッダー下のキャッチコピー（例: いつでも、どこでも、学びのレシピ）';
COMMENT ON COLUMN public.site_settings.footer_text IS 'フッター横のテキスト（サブタイトルと別に編集可能）';

INSERT INTO public.site_settings (id, subtitle, footer_text)
VALUES (
  'main',
  'いつでも、どこでも、学びのレシピ',
  'SPACE ARCHIVE — いつでも、どこでも、学びのレシピ'
)
ON CONFLICT (id) DO UPDATE SET
  subtitle = COALESCE(EXCLUDED.subtitle, site_settings.subtitle),
  footer_text = COALESCE(EXCLUDED.footer_text, site_settings.footer_text),
  updated_at = NOW();

-- RLS: 参照は全員、更新は管理者のみ
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site_settings"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update site_settings"
  ON public.site_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can insert site_settings"
  ON public.site_settings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
