-- Phase 1: プラン・コンテンツ階層の拡張
-- サブスク移行用: profiles.plan を BASIC/PRO/ADVANCE 対応に、slides に content_tier を追加

-- ============================================================
-- 1. profiles.plan の CHECK 制約を拡張
-- ============================================================
-- 既存の制約を削除してから新しい値を許可（postgres は制約名が profiles_plan_check のことが多い）
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'basic', 'pro', 'advance', 'premium'));

COMMENT ON COLUMN public.profiles.plan IS 'free=無料, basic/pro/advance=サブスクプラン, premium=レガシー（ADVANCE相当）';

-- ============================================================
-- 2. slides に content_tier カラム追加
-- ============================================================
ALTER TABLE public.slides
  ADD COLUMN IF NOT EXISTS content_tier TEXT
  CHECK (content_tier IS NULL OR content_tier IN ('basic', 'pro', 'advance'));

COMMENT ON COLUMN public.slides.content_tier IS 'basic=BASICプランでフル閲覧, pro=PROでレンタル/購入, advance=ADVANCEのみ。NULLはbasic扱い';

-- 既存データの初期値: visibility に合わせて設定
UPDATE public.slides
SET content_tier = 'basic'
WHERE content_tier IS NULL;

-- デフォルトを basic に（新規行用）
ALTER TABLE public.slides
  ALTER COLUMN content_tier SET DEFAULT 'basic';
