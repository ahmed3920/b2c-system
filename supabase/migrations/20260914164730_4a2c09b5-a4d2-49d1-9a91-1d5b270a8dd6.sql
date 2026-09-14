CREATE TABLE public.project_audit_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_audit_access TO authenticated;
GRANT ALL ON public.project_audit_access TO service_role;
ALTER TABLE public.project_audit_access ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_project_audit_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.project_audit_access WHERE user_id = _user_id)
$$;

CREATE POLICY "Admins manage project audit access"
  ON public.project_audit_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can see their own access row"
  ON public.project_audit_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.project_audit_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id bigint NOT NULL UNIQUE,
  student_external_id text,
  student_name text,
  tutor_external_id text,
  tutor_name text,
  team_leader text,
  project_title text,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_audit_decisions TO authenticated;
GRANT ALL ON public.project_audit_decisions TO service_role;
ALTER TABLE public.project_audit_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project auditors can view decisions"
  ON public.project_audit_decisions FOR SELECT TO authenticated
  USING (public.has_project_audit_access(auth.uid()));

CREATE POLICY "Project auditors can record decisions"
  ON public.project_audit_decisions FOR INSERT TO authenticated
  WITH CHECK (public.has_project_audit_access(auth.uid()));

CREATE POLICY "Project auditors can update decisions"
  ON public.project_audit_decisions FOR UPDATE TO authenticated
  USING (public.has_project_audit_access(auth.uid()))
  WITH CHECK (public.has_project_audit_access(auth.uid()));

CREATE POLICY "Admins can delete decisions"
  ON public.project_audit_decisions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_project_audit_decisions_updated_at
  BEFORE UPDATE ON public.project_audit_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_project_audit_decisions_status ON public.project_audit_decisions (status);