-- スライドにキャプションを追加（ホバー表示・管理画面で編集用）

ALTER TABLE public.slides
  ADD COLUMN IF NOT EXISTS caption TEXT;

COMMENT ON COLUMN public.slides.caption IS 'スライドの簡易説明（2行程度）。PDFから自動作成可能。';
