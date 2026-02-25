-- 特定メールアドレスでサインアップしたユーザーを自動で管理者にする
-- riefuku@gmail.com（福本さん）、kaiman9705@gmail.com が該当

-- 既存ユーザーで該当メールの場合は is_admin を true に（福本さんがすでにサインアップしている場合用）
UPDATE public.profiles
SET is_admin = true
WHERE id IN (
  SELECT id FROM auth.users
  WHERE LOWER(TRIM(email)) IN ('riefuku@gmail.com', 'kaiman9705@gmail.com')
);

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
  VALUES (NEW.id, 'free', is_admin_user);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

COMMENT ON FUNCTION public.handle_new_user() IS 'サインアップ時に profiles を作成。admin_emails に含まれるメールの場合は is_admin = true';
