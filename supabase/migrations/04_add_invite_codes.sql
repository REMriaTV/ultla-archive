-- 招待コードテーブル
-- 信頼できる関係者にメッセージで別途共有する想定

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: サーバー側（service role）のみアクセス。クライアントからは直接読まない
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- 誰も直接 SELECT できない（API 経由で検証のみ）
CREATE POLICY "No direct access"
  ON public.invite_codes FOR ALL
  USING (false);

-- profiles に access_granted を追加
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_granted BOOLEAN NOT NULL DEFAULT false;

-- 既存ユーザーはアクセス付与済みとする
UPDATE public.profiles SET access_granted = true WHERE access_granted = false;

-- 新規ユーザーは access_granted = false で作成（handle_new_user はデフォルトのまま）
-- トリガーは変更不要（INSERT 時に access_granted を指定しなければ DEFAULT false）

-- 招待コードを1件投入（運用で追加・管理）
INSERT INTO public.invite_codes (code, max_uses)
VALUES ('ULTLA2025', 100)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.invite_codes IS '招待コード（クローズド運用用）';
COMMENT ON COLUMN public.profiles.access_granted IS '招待コードでアクセス付与済みか';
