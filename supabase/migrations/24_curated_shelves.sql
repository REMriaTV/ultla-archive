-- Phase 5: キュレーション棚（動画・スライド混在）

CREATE TABLE IF NOT EXISTS public.shelves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shelf_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shelf_id UUID NOT NULL REFERENCES public.shelves(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('slide', 'video')),
  content_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shelves_sort_order ON public.shelves(sort_order);
CREATE INDEX IF NOT EXISTS idx_shelves_is_published ON public.shelves(is_published);
CREATE INDEX IF NOT EXISTS idx_shelf_items_shelf_sort ON public.shelf_items(shelf_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_shelf_items_content ON public.shelf_items(content_type, content_id);

ALTER TABLE public.shelves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shelf_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shelves_select" ON public.shelves;
CREATE POLICY "shelves_select"
  ON public.shelves FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "shelves_insert" ON public.shelves;
CREATE POLICY "shelves_insert"
  ON public.shelves FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "shelves_update" ON public.shelves;
CREATE POLICY "shelves_update"
  ON public.shelves FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "shelves_delete" ON public.shelves;
CREATE POLICY "shelves_delete"
  ON public.shelves FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "shelf_items_select" ON public.shelf_items;
CREATE POLICY "shelf_items_select"
  ON public.shelf_items FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "shelf_items_insert" ON public.shelf_items;
CREATE POLICY "shelf_items_insert"
  ON public.shelf_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "shelf_items_update" ON public.shelf_items;
CREATE POLICY "shelf_items_update"
  ON public.shelf_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "shelf_items_delete" ON public.shelf_items;
CREATE POLICY "shelf_items_delete"
  ON public.shelf_items FOR DELETE
  TO authenticated
  USING (true);
