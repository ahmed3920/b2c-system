
CREATE TYPE public.tutor_status_value AS ENUM ('active', 'resigned', 'terminated');

CREATE TABLE public.tutor_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_external_id TEXT NOT NULL UNIQUE,
  tutor_name TEXT NOT NULL,
  team_leader TEXT,
  is_mentor BOOLEAN NOT NULL DEFAULT false,
  status public.tutor_status_value NOT NULL DEFAULT 'active',
  effective_date DATE,
  notes TEXT,
  set_by UUID,
  set_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tutor_status_team_leader ON public.tutor_status (team_leader);
CREATE INDEX idx_tutor_status_status ON public.tutor_status (status);

ALTER TABLE public.tutor_status ENABLE ROW LEVEL SECURITY;

-- Admins
CREATE POLICY "Admins manage tutor_status"
  ON public.tutor_status
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Super team leaders
CREATE POLICY "Super team leaders manage tutor_status"
  ON public.tutor_status
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_team_leader'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_team_leader'::app_role));

-- Team leaders manage their own team's tutor_status
CREATE POLICY "Team leaders manage their team tutor_status"
  ON public.tutor_status
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'team_leader'::app_role)
    AND public.team_leader_name_matches(team_leader, public.get_current_user_mentor_name())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'team_leader'::app_role)
    AND public.team_leader_name_matches(team_leader, public.get_current_user_mentor_name())
  );

-- Authenticated users can view all tutor_status records (read-only)
CREATE POLICY "Authenticated view tutor_status"
  ON public.tutor_status
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER tr_tutor_status_updated_at
  BEFORE UPDATE ON public.tutor_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.tutor_status;
