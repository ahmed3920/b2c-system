
CREATE TABLE IF NOT EXISTS public.weekly_study_plan_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  team_leader text,
  tutors_count integer NOT NULL DEFAULT 0,
  items_count integer NOT NULL DEFAULT 0,
  total_free_hours numeric NOT NULL DEFAULT 0,
  total_planned_hours numeric NOT NULL DEFAULT 0,
  generated_by uuid,
  generated_by_name text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wsps_week ON public.weekly_study_plan_snapshots(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_wsps_tl ON public.weekly_study_plan_snapshots(team_leader);

ALTER TABLE public.weekly_study_plan_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage snapshots"
ON public.weekly_study_plan_snapshots
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "TL view team snapshots"
ON public.weekly_study_plan_snapshots
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND (
    team_leader IS NULL
    OR public.team_leader_name_matches(team_leader, public.get_current_user_mentor_name())
  )
);
