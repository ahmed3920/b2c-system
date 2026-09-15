CREATE TYPE public.project_eval_status AS ENUM ('fully_working','partially_working','not_working','invalid_submission','pending');
CREATE TYPE public.project_assignment_state AS ENUM ('open','done','released');

CREATE TABLE public.project_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id bigint NOT NULL UNIQUE,
  check_access boolean NOT NULL DEFAULT false,
  check_evidence boolean NOT NULL DEFAULT false,
  check_core_function boolean NOT NULL DEFAULT false,
  status public.project_eval_status NOT NULL,
  points integer NOT NULL DEFAULT 0,
  note text,
  evidence_url text,
  student_external_id text,
  student_name text,
  tutor_external_id text,
  tutor_name text,
  team_leader text,
  project_title text,
  project_created_at timestamptz,
  reviewed_by uuid,
  reviewed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_evaluations TO authenticated;
GRANT ALL ON public.project_evaluations TO service_role;
ALTER TABLE public.project_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auditors read evaluations" ON public.project_evaluations
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_project_audit_access(auth.uid()));

CREATE POLICY "Auditors insert own evaluations" ON public.project_evaluations
FOR INSERT TO authenticated
WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_project_audit_access(auth.uid())) AND reviewed_by = auth.uid());

CREATE POLICY "Reviewers update own evaluations" ON public.project_evaluations
FOR UPDATE TO authenticated
USING (reviewed_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK (reviewed_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins delete evaluations" ON public.project_evaluations
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER update_project_evaluations_updated_at
BEFORE UPDATE ON public.project_evaluations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.project_review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id bigint NOT NULL UNIQUE,
  assigned_to uuid NOT NULL,
  assigned_to_name text,
  assigned_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  state public.project_assignment_state NOT NULL DEFAULT 'open',
  student_external_id text,
  student_name text,
  grade text,
  tutor_external_id text,
  tutor_name text,
  team_leader text,
  project_title text,
  project_created_at timestamptz,
  group_key text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_review_assignments TO authenticated;
GRANT ALL ON public.project_review_assignments TO service_role;
ALTER TABLE public.project_review_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auditors read assignments" ON public.project_review_assignments
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_project_audit_access(auth.uid()));

CREATE POLICY "Admins insert assignments" ON public.project_review_assignments
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Reviewers update own assignments" ON public.project_review_assignments
FOR UPDATE TO authenticated
USING (assigned_to = auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK (assigned_to = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins delete assignments" ON public.project_review_assignments
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER update_project_review_assignments_updated_at
BEFORE UPDATE ON public.project_review_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pra_assigned ON public.project_review_assignments (assigned_to, state);
CREATE INDEX idx_pra_day ON public.project_review_assignments (assigned_on);