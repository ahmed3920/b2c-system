
CREATE TABLE public.engagement_uploads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_external_id text,
  tutor_name text NOT NULL,
  is_mentor boolean DEFAULT false,
  tutor_language text,
  availability_type text,
  team_leader text NOT NULL,
  month date NOT NULL,
  total_sessions integer DEFAULT 0,
  sessions_with_feedback integer DEFAULT 0,
  rating numeric,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX engagement_uploads_unique_tutor_month
  ON public.engagement_uploads (COALESCE(tutor_external_id, tutor_name), month);

CREATE INDEX engagement_uploads_team_leader_month_idx
  ON public.engagement_uploads (team_leader, month);

ALTER TABLE public.engagement_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all engagement uploads"
  ON public.engagement_uploads
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team leaders view their engagement uploads"
  ON public.engagement_uploads
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'team_leader'::app_role)
    AND team_leader = get_current_user_mentor_name()
  );

CREATE TRIGGER update_engagement_uploads_updated_at
  BEFORE UPDATE ON public.engagement_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
