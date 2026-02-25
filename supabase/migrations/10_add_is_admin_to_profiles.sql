-- 管理者フラグを profiles に追加

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_admin IS '管理画面にアクセスできる管理者かどうか';

