-- Phase 3: ログイン＝BASIC アカウント
-- 新規サインアップは plan=basic、既存の plan=free も basic に統一（ゲストはプロファイルを持たない）

-- ============================================================
-- 1. 既存の plan=free を basic に更新（ログイン済みユーザー＝BASIC）
-- ============================================================
UPDATE public.profiles
SET plan = 'basic', updated_at = NOW()
WHERE plan = 'free';

-- ============================================================
-- 2. サインアップ時のデフォルトを basic に変更
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  admin_emails TEXT[] := ARRAY['riefuku@gmail.com', 'kaiman9705@gmail.com'];
  user_email TEXT;
  is_admin_user BOOLEAN := false;
  i INT;
BEGIN
  user_email := LOWER(TRIM(COALESCE(NEW.email, '')));
  FOR i IN 1..array_length(admin_emails, 1) LOOP
    IF user_email = admin_emails[i] THEN
      is_admin_user := true;
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.profiles (id, plan, is_admin)
  VALUES (NEW.id, 'basic', is_admin_user);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

COMMENT ON FUNCTION public.handle_new_user() IS 'サインアップ時に profiles を作成。plan=basic（ログイン＝BASIC）。admin_emails に含まれる場合は is_admin=true';

-- profiles テーブルのデフォルトも basic に（直接 INSERT する場合用）
ALTER TABLE public.profiles
  ALTER COLUMN plan SET DEFAULT 'basic';

COMMENT ON COLUMN public.profiles.plan IS 'free=未使用（ゲストはプロファイルなし）, basic=ログイン済み無料, pro/advance/premium=サブスク';
