CREATE TABLE public.quality_flag_followups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_id bigint NOT NULL UNIQUE,
  review_id bigint,
  tutor_tid text,
  tutor_name text,
  team_leader text,
  status text NOT NULL DEFAULT 'open',
  note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_flag_followups TO authenticated;
GRANT ALL ON public.quality_flag_followups TO service_role;

ALTER TABLE public.quality_flag_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view flag follow-ups"
ON public.quality_flag_followups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can add flag follow-ups"
ON public.quality_flag_followups FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team_leader')
  OR public.has_role(auth.uid(), 'super_team_leader')
  OR public.has_role(auth.uid(), 'mentor')
  OR public.has_role(auth.uid(), 'community_moderator')
);

CREATE POLICY "Staff can edit flag follow-ups"
ON public.quality_flag_followups FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team_leader')
  OR public.has_role(auth.uid(), 'super_team_leader')
  OR public.has_role(auth.uid(), 'mentor')
  OR public.has_role(auth.uid(), 'community_moderator')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team_leader')
  OR public.has_role(auth.uid(), 'super_team_leader')
  OR public.has_role(auth.uid(), 'mentor')
  OR public.has_role(auth.uid(), 'community_moderator')
);

CREATE POLICY "Admins can delete flag follow-ups"
ON public.quality_flag_followups FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_quality_flag_followups_updated_at
BEFORE UPDATE ON public.quality_flag_followups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();