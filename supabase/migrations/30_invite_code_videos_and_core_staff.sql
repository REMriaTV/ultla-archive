-- 招待コードで動画も個別に共有できるようにする
CREATE TABLE IF NOT EXISTS public.invite_code_videos (
  invite_code_id UUID NOT NULL REFERENCES public.invite_codes(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  PRIMARY KEY (invite_code_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_invite_code_videos_video_id
  ON public.invite_code_videos(video_id);

COMMENT ON TABLE public.invite_code_videos IS '招待コードごとに閲覧可能な動画を紐づけ';

ALTER TABLE public.invite_code_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access"
  ON public.invite_code_videos FOR ALL
  USING (false);

-- コアスタッフ用: 管理画面権限は持たず、視聴は管理者同等
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_core_staff BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_core_staff IS 'コアスタッフ（管理画面権限なし、視聴は管理者同等）';
