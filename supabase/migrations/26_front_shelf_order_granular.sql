-- Phase 7: フロント棚順序の細粒度化（program 単位）

ALTER TABLE public.front_shelf_order
  DROP CONSTRAINT IF EXISTS front_shelf_order_shelf_type_check;

-- 旧固定棚の行を削除
DELETE FROM public.front_shelf_order
WHERE shelf_type IN ('fixed_programs', 'fixed_videos');

ALTER TABLE public.front_shelf_order
  ADD CONSTRAINT front_shelf_order_shelf_type_check
  CHECK (shelf_type IN ('program_shelf', 'video_program_shelf', 'curated_shelf'));

-- show_on_front=true の program を program 単位で順序登録
WITH target_programs AS (
  SELECT id::text AS ref_id, ROW_NUMBER() OVER (ORDER BY started_year NULLS LAST, id) AS rn
  FROM public.programs
  WHERE COALESCE(show_on_front, true) = true
)
INSERT INTO public.front_shelf_order (shelf_type, ref_id, sort_order, is_enabled)
SELECT 'program_shelf', ref_id, rn * 10, true
FROM target_programs
ON CONFLICT (shelf_type, ref_id) DO NOTHING;

WITH target_programs AS (
  SELECT id::text AS ref_id, ROW_NUMBER() OVER (ORDER BY started_year NULLS LAST, id) AS rn
  FROM public.programs
  WHERE COALESCE(show_on_front, true) = true
)
INSERT INTO public.front_shelf_order (shelf_type, ref_id, sort_order, is_enabled)
SELECT 'video_program_shelf', ref_id, rn * 10 + 1, true
FROM target_programs
ON CONFLICT (shelf_type, ref_id) DO NOTHING;
