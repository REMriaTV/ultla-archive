-- ジャンル種別をテーブル化し、管理画面で追加・編集・削除できるようにする
-- 既存の program / organization / municipality を移行。「組織」→「組織をオーガナイズ」に表記変更

CREATE TABLE IF NOT EXISTS public.genre_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.genre_types IS 'ジャンル種別（プログラム・組織をオーガナイズ・自治体等）。管理画面で追加・編集可';

INSERT INTO public.genre_types (id, name, sort_order) VALUES
  ('program', 'プログラム', 0),
  ('organization', '組織をオーガナイズ', 1),
  ('municipality', '自治体', 2)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- programs の CHECK を外し、genre_types への外部キーに変更
ALTER TABLE public.programs
  DROP CONSTRAINT IF EXISTS programs_genre_type_check;

ALTER TABLE public.programs
  ADD CONSTRAINT programs_genre_type_fkey
  FOREIGN KEY (genre_type) REFERENCES public.genre_types(id) ON DELETE RESTRICT;

-- RLS: 参照は全員（サイドバー用）、変更は service role 経由のみ想定
ALTER TABLE public.genre_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read genre_types"
  ON public.genre_types FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert genre_types"
  ON public.genre_types FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can update genre_types"
  ON public.genre_types FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can delete genre_types"
  ON public.genre_types FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

COMMENT ON COLUMN public.programs.genre_type IS 'genre_types.id への参照。管理画面でジャンル種別を追加・編集可能';
