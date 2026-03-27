-- Phase 6: フロント棚の並び順管理（固定棚 + キュレーション棚）

CREATE TABLE IF NOT EXISTS public.front_shelf_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shelf_type TEXT NOT NULL CHECK (shelf_type IN ('fixed_programs', 'fixed_videos', 'curated_shelf')),
  ref_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shelf_type, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_front_shelf_order_sort ON public.front_shelf_order(sort_order);
CREATE INDEX IF NOT EXISTS idx_front_shelf_order_enabled ON public.front_shelf_order(is_enabled);

ALTER TABLE public.front_shelf_order ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "front_shelf_order_select" ON public.front_shelf_order;
CREATE POLICY "front_shelf_order_select"
  ON public.front_shelf_order FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "front_shelf_order_insert" ON public.front_shelf_order;
CREATE POLICY "front_shelf_order_insert"
  ON public.front_shelf_order FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "front_shelf_order_update" ON public.front_shelf_order;
CREATE POLICY "front_shelf_order_update"
  ON public.front_shelf_order FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "front_shelf_order_delete" ON public.front_shelf_order;
CREATE POLICY "front_shelf_order_delete"
  ON public.front_shelf_order FOR DELETE
  TO authenticated
  USING (true);

INSERT INTO public.front_shelf_order (shelf_type, ref_id, sort_order, is_enabled)
VALUES
  ('fixed_videos', '__fixed_videos__', 10, true),
  ('fixed_programs', '__fixed_programs__', 20, true)
ON CONFLICT (shelf_type, ref_id) DO NOTHING;
