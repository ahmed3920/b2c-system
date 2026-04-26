
-- Official holidays: each row = one holiday day, deducts 5h per tutor when in week range
CREATE TABLE public.official_holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date date NOT NULL UNIQUE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.official_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage holidays"
  ON public.official_holidays
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view holidays"
  ON public.official_holidays
  FOR SELECT TO authenticated
  USING (true);

-- Persistent blocked modules per tutor (e.g. device limitation)
CREATE TABLE public.tutor_blocked_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_external_id text NOT NULL,
  module_id uuid NOT NULL REFERENCES public.study_modules(id) ON DELETE CASCADE,
  reason text DEFAULT 'Device Limitation',
  team_leader text,
  blocked_by uuid,
  blocked_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_external_id, module_id)
);

CREATE INDEX idx_tutor_blocked_modules_tutor ON public.tutor_blocked_modules(tutor_external_id);

ALTER TABLE public.tutor_blocked_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all blocks"
  ON public.tutor_blocked_modules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "TL view team blocks"
  ON public.tutor_blocked_modules
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'team_leader'::app_role) OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
    AND (
      team_leader IS NULL
      OR public.team_leader_name_matches(team_leader, public.get_current_user_mentor_name())
      OR EXISTS (
        SELECT 1 FROM public.tutor_weekly_occupation o
        WHERE o.tutor_external_id = tutor_blocked_modules.tutor_external_id
          AND public.team_leader_name_matches(o.team_leader, public.get_current_user_mentor_name())
      )
    )
  );

CREATE POLICY "TL insert team blocks"
  ON public.tutor_blocked_modules
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'team_leader'::app_role) OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
    AND (
      team_leader IS NULL
      OR public.team_leader_name_matches(team_leader, public.get_current_user_mentor_name())
    )
  );

CREATE POLICY "TL delete team blocks"
  ON public.tutor_blocked_modules
  FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'team_leader'::app_role) OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
    AND (
      team_leader IS NULL
      OR public.team_leader_name_matches(team_leader, public.get_current_user_mentor_name())
    )
  );

CREATE TRIGGER trg_tutor_blocked_modules_updated_at
  BEFORE UPDATE ON public.tutor_blocked_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
