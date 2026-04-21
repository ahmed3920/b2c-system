-- Edu description types
CREATE TYPE public.edu_description_type AS ENUM ('deduction', 'no_deduction', 'neutral');
CREATE TYPE public.edu_validation_status AS ENUM ('deduct', 'no_deduction', 'pending');

-- Edu Descriptions (admin-controlled lookup)
CREATE TABLE public.edu_descriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type public.edu_description_type NOT NULL DEFAULT 'neutral',
  color TEXT NOT NULL DEFAULT '#64748b',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.edu_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage edu_descriptions"
ON public.edu_descriptions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view active edu_descriptions"
ON public.edu_descriptions FOR SELECT TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_edu_descriptions_updated_at
BEFORE UPDATE ON public.edu_descriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Live Session Issues (mirror of moderation sheet + edu layer)
CREATE TABLE public.live_session_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE,             -- composite Session ID + From Tutor ID
  -- Core typed fields (extracted from sheet)
  session_id TEXT,
  student_id TEXT,
  session_date DATE,
  moderator_name TEXT,
  group_type TEXT,
  time_slot TEXT,
  from_tutor_id TEXT,
  from_tutor_name TEXT,
  to_tutor_id TEXT,
  to_tutor_name TEXT,
  action_status TEXT,
  issue_reason TEXT,
  issue_time TEXT,
  issue_details TEXT,
  extra_action TEXT,
  class_type TEXT,
  month TEXT,
  source_of_issue TEXT,
  from_tutor_type TEXT,
  to_tutor_type TEXT,
  language TEXT,
  year TEXT,
  team_leader TEXT,
  day_of_week TEXT,
  severity TEXT,
  moderator_decision TEXT,
  moderation_deduction TEXT,
  -- Full sheet row (for any columns not captured above)
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Edu layer (editable)
  edu_validation public.edu_validation_status,
  edu_description_id UUID REFERENCES public.edu_descriptions(id) ON DELETE SET NULL,
  edu_notes TEXT,
  -- Metadata
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lsi_session_date ON public.live_session_issues(session_date DESC);
CREATE INDEX idx_lsi_from_tutor_id ON public.live_session_issues(from_tutor_id);
CREATE INDEX idx_lsi_team_leader ON public.live_session_issues(team_leader);
CREATE INDEX idx_lsi_edu_validation ON public.live_session_issues(edu_validation);

ALTER TABLE public.live_session_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage live_session_issues"
ON public.live_session_issues FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leaders view their team issues"
ON public.live_session_issues FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_leader')
  AND team_leader = public.get_current_user_mentor_name()
);

CREATE POLICY "Team leaders update edu fields for their team"
ON public.live_session_issues FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'team_leader')
  AND team_leader = public.get_current_user_mentor_name()
)
WITH CHECK (
  public.has_role(auth.uid(), 'team_leader')
  AND team_leader = public.get_current_user_mentor_name()
);

CREATE TRIGGER update_lsi_updated_at
BEFORE UPDATE ON public.live_session_issues
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit log for edu layer changes
CREATE TABLE public.live_session_issue_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.live_session_issues(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL,
  changed_by UUID,
  changed_by_name TEXT,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lsi_audit_issue_id ON public.live_session_issue_audit(issue_id, created_at DESC);

ALTER TABLE public.live_session_issue_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all audit"
ON public.live_session_issue_audit FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "TL view audit for their team"
ON public.live_session_issue_audit FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_leader')
  AND EXISTS (
    SELECT 1 FROM public.live_session_issues i
    WHERE i.id = live_session_issue_audit.issue_id
      AND i.team_leader = public.get_current_user_mentor_name()
  )
);

CREATE POLICY "Authenticated insert audit"
ON public.live_session_issue_audit FOR INSERT TO authenticated
WITH CHECK (changed_by = auth.uid());

-- Sync config (reuse pattern of study_plan_sheet_configs but separate table)
CREATE TABLE public.live_issues_sheet_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  csv_url TEXT,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_message TEXT,
  last_sync_rows INTEGER,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.live_issues_sheet_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage live_issues_sheet_config"
ON public.live_issues_sheet_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read live_issues_sheet_config"
ON public.live_issues_sheet_config FOR SELECT TO authenticated
USING (true);

-- Seed a single config row
INSERT INTO public.live_issues_sheet_config (csv_url) VALUES (NULL);

-- Seed a few default edu descriptions
INSERT INTO public.edu_descriptions (name, type, color, display_order) VALUES
  ('Tech / Electrical Issue', 'no_deduction', '#10b981', 10),
  ('Emergency / Excuse Out of System', 'no_deduction', '#10b981', 20),
  ('No Contact', 'deduction', '#ef4444', 30),
  ('Repeated No Show', 'deduction', '#ef4444', 40),
  ('Pending Investigation', 'neutral', '#f59e0b', 50);
