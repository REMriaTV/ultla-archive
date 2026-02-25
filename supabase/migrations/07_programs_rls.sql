-- programs テーブルに RLS を有効化し、ポリシーを追加
-- 403 で新ジャンル登録が失敗する場合は、RLS が有効だがポリシーがないため

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- 一覧・参照: 誰でも可（トップページ・管理画面の読み込み用）
CREATE POLICY "programs_select"
  ON public.programs FOR SELECT
  USING (true);

-- 追加・更新・削除: 認証済みユーザーのみ（管理画面でログイン済みの場合）
CREATE POLICY "programs_insert"
  ON public.programs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "programs_update"
  ON public.programs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "programs_delete"
  ON public.programs FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON TABLE public.programs IS 'ジャンル（プログラム・組織・自治体）。RLS: 参照は全員、変更は認証済みのみ';
