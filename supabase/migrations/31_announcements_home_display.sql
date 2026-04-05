-- トップページ（公開ホーム）に表示するお知らせを複数選択可能にする
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS show_on_home boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_sort_order integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.announcements.show_on_home IS '公開中かつ ON のときトップページにお知らせカードを表示';
COMMENT ON COLUMN public.announcements.home_sort_order IS 'トップでの並び（昇順。同値のときは公開日が新しい順）';

-- これまで「最新1件がトップに出る」挙動に近づけるため、現時点で最新の公開お知らせ1件をトップ表示にする（再実行しても同じ行が選ばれるだけ）
UPDATE public.announcements a
SET show_on_home = true, home_sort_order = 0
WHERE a.is_published = true
  AND a.id = (
    SELECT id FROM public.announcements
    WHERE is_published = true
    ORDER BY published_at DESC NULLS LAST
    LIMIT 1
  );
