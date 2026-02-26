-- 招待コードに「既定の有効期限」を追加。管理者が設定した日時まで、そのコードで登録したユーザーが閲覧可能。
ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS default_expires_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.invite_codes.default_expires_at IS 'このコードで付与するアクセスの有効期限（NULLの場合は付与日から1ヶ月）。管理者が設定・編集可能。';

-- 葉山（名前またはコードに「葉山」を含む）の期限を 2026-03-05 の終わり（JST 23:59 = UTC 14:59）に設定
UPDATE public.invite_codes
SET default_expires_at = '2026-03-05T14:59:59.000Z'
WHERE (name IS NOT NULL AND name LIKE '%葉山%')
   OR (code IS NOT NULL AND (code LIKE '%hayama%' OR code LIKE '%葉山%'));
