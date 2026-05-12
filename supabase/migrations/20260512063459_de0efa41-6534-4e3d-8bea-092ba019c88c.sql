CREATE TABLE public.tutor_roster_overrides (
  tutor_external_id text PRIMARY KEY,
  name text NOT NULL,
  team_leader text,
  mentor text,
  ranking text,
  phone text,
  role text,
  language text,
  employment_type text,
  is_new boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_roster_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read roster overrides"
ON public.tutor_roster_overrides FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins/TLs can manage roster overrides"
ON public.tutor_roster_overrides FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'team_leader'::app_role)
  OR public.has_role(auth.uid(), 'super_team_leader'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'team_leader'::app_role)
  OR public.has_role(auth.uid(), 'super_team_leader'::app_role)
);

CREATE TRIGGER tutor_roster_overrides_updated_at
BEFORE UPDATE ON public.tutor_roster_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();