
-- Extend cms_attendance
ALTER TABLE public.cms_attendance
  ADD COLUMN IF NOT EXISTS check_out_time timestamptz,
  ADD COLUMN IF NOT EXISTS working_minutes integer,
  ADD COLUMN IF NOT EXISTS active_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activity_status text;

-- Activity logs (one row per user per minute-bucket per status)
CREATE TABLE IF NOT EXISTS public.cms_user_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL,
  bucket_start timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active','idle','inactive')),
  seconds integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, bucket_start, status)
);

CREATE INDEX IF NOT EXISTS idx_cms_activity_user_date ON public.cms_user_activity_logs (user_id, date);
CREATE INDEX IF NOT EXISTS idx_cms_activity_date ON public.cms_user_activity_logs (date);

ALTER TABLE public.cms_user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CMS users insert own activity"
  ON public.cms_user_activity_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_cms_user(auth.uid()));

CREATE POLICY "CMS users update own activity"
  ON public.cms_user_activity_logs FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "CMS users view own activity"
  ON public.cms_user_activity_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "CMS admins manage all activity"
  ON public.cms_user_activity_logs FOR ALL TO authenticated
  USING (public.has_cms_role(auth.uid(), 'cms_admin'::cms_app_role))
  WITH CHECK (public.has_cms_role(auth.uid(), 'cms_admin'::cms_app_role));

CREATE POLICY "CMS supervisors view all activity"
  ON public.cms_user_activity_logs FOR SELECT TO authenticated
  USING (public.has_cms_role(auth.uid(), 'cms_supervisor'::cms_app_role));
