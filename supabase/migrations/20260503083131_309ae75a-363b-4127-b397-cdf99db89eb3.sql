
-- ============ Categories ============
CREATE TABLE public.session_incident_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.session_incident_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage incident categories" ON public.session_incident_categories
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Authenticated view active incident categories" ON public.session_incident_categories
  FOR SELECT TO authenticated USING (is_active = true OR has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_sic_updated BEFORE UPDATE ON public.session_incident_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.session_incident_categories (name, display_order) VALUES
  ('Technical Problems', 1),
  ('Needs Module change', 2),
  ('Behavioral Issues', 3),
  ('Attendance Problems', 4),
  ('Skill Gap', 5),
  ('Homework Non-Compliance', 6),
  ('Language Barrier', 7),
  ('Parental/Home Environment', 8),
  ('Schedule/Timing Issues', 9),
  ('Other', 10);

-- ============ Field config ============
CREATE TABLE public.session_incident_field_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name text NOT NULL UNIQUE,
  field_label text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  is_visible boolean NOT NULL DEFAULT true,
  is_locked boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.session_incident_field_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage incident field config" ON public.session_incident_field_config
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Authenticated view incident field config" ON public.session_incident_field_config
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_sifc_updated BEFORE UPDATE ON public.session_incident_field_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.session_incident_field_config (field_name, field_label, is_required, is_visible, is_locked, display_order) VALUES
  ('student_id',        'Student ID',         true,  true, false, 1),
  ('student_name',      'Student Name',       true,  true, false, 2),
  ('student_grade',     'Student Grade',      true,  true, false, 3),
  ('tutor_external_id', 'Tutor ID',           true,  true, true,  4),
  ('session_date',      'Session Date',       true,  true, false, 5),
  ('session_number',    'Session Number',     true,  true, false, 6),
  ('case_category',     'Case Category',      true,  true, true,  7),
  ('case_description',  'Case Description',   true,  true, false, 8),
  ('supporting_link',   'Supporting Document Link', false, true, false, 9);

-- ============ Tokens ============
CREATE TABLE public.session_incident_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24),'hex'),
  tutor_external_id text NOT NULL,
  tutor_name text NOT NULL,
  team_leader text NOT NULL,
  created_by uuid NOT NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  use_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.session_incident_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage incident tokens" ON public.session_incident_tokens
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "TL/Mentor view their incident tokens" ON public.session_incident_tokens
  FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "TL/Mentor insert incident tokens" ON public.session_incident_tokens
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND (
      has_role(auth.uid(),'team_leader'::app_role)
      OR has_role(auth.uid(),'super_team_leader'::app_role)
      OR has_role(auth.uid(),'mentor'::app_role)
      OR has_role(auth.uid(),'community_moderator'::app_role)
    )
  );
CREATE POLICY "TL/Mentor update their incident tokens" ON public.session_incident_tokens
  FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- ============ Incidents ============
CREATE TABLE public.session_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text,
  student_name text,
  student_grade text,
  tutor_external_id text NOT NULL,
  tutor_name text NOT NULL,
  team_leader text NOT NULL,
  assigned_mentor_name text,
  session_date date,
  session_number text,
  case_category text NOT NULL,
  case_description text,
  supporting_link text,
  source text NOT NULL DEFAULT 'staff' CHECK (source IN ('staff','tutor_self')),
  submitted_by uuid,
  submitted_by_name text,
  validation_status text NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','approved','rejected')),
  validated_by uuid,
  validated_by_name text,
  validated_at timestamptz,
  rejection_reason text,
  sent_to_cs boolean NOT NULL DEFAULT false,
  token_id uuid REFERENCES public.session_incident_tokens(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_si_team_leader ON public.session_incidents(team_leader);
CREATE INDEX idx_si_assigned_mentor ON public.session_incidents(assigned_mentor_name);
CREATE INDEX idx_si_status ON public.session_incidents(validation_status);
CREATE INDEX idx_si_tutor ON public.session_incidents(tutor_external_id);

ALTER TABLE public.session_incidents ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_si_updated BEFORE UPDATE ON public.session_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Admins manage all incidents" ON public.session_incidents
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Super TL view all incidents" ON public.session_incidents
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'super_team_leader'::app_role));
CREATE POLICY "Super TL update all incidents" ON public.session_incidents
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'super_team_leader'::app_role)) WITH CHECK (has_role(auth.uid(),'super_team_leader'::app_role));

CREATE POLICY "TL view team incidents" ON public.session_incidents
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(),'team_leader'::app_role)
    AND team_leader_name_matches(team_leader, get_current_user_mentor_name())
  );
CREATE POLICY "TL update team incidents" ON public.session_incidents
  FOR UPDATE TO authenticated USING (
    has_role(auth.uid(),'team_leader'::app_role)
    AND team_leader_name_matches(team_leader, get_current_user_mentor_name())
  ) WITH CHECK (
    has_role(auth.uid(),'team_leader'::app_role)
    AND team_leader_name_matches(team_leader, get_current_user_mentor_name())
  );

CREATE POLICY "Mentor view assigned incidents" ON public.session_incidents
  FOR SELECT TO authenticated USING (
    (has_role(auth.uid(),'mentor'::app_role) OR has_role(auth.uid(),'community_moderator'::app_role))
    AND assigned_mentor_name IS NOT NULL
    AND team_leader_name_matches(assigned_mentor_name, get_current_user_mentor_name())
  );
CREATE POLICY "Mentor update assigned incidents" ON public.session_incidents
  FOR UPDATE TO authenticated USING (
    (has_role(auth.uid(),'mentor'::app_role) OR has_role(auth.uid(),'community_moderator'::app_role))
    AND assigned_mentor_name IS NOT NULL
    AND team_leader_name_matches(assigned_mentor_name, get_current_user_mentor_name())
  ) WITH CHECK (
    (has_role(auth.uid(),'mentor'::app_role) OR has_role(auth.uid(),'community_moderator'::app_role))
    AND assigned_mentor_name IS NOT NULL
    AND team_leader_name_matches(assigned_mentor_name, get_current_user_mentor_name())
  );

CREATE POLICY "Staff insert incidents" ON public.session_incidents
  FOR INSERT TO authenticated WITH CHECK (
    submitted_by = auth.uid() AND source = 'staff' AND (
      has_role(auth.uid(),'admin'::app_role)
      OR has_role(auth.uid(),'team_leader'::app_role)
      OR has_role(auth.uid(),'super_team_leader'::app_role)
      OR has_role(auth.uid(),'mentor'::app_role)
      OR has_role(auth.uid(),'community_moderator'::app_role)
    )
  );

-- Feature controls entry
INSERT INTO public.feature_controls (feature_key, name, description, route_path, display_order)
VALUES ('session_incidents', 'Session Incidents', 'Edu-to-CS session incident tickets with tutor self-submission', '/session-incidents', 200)
ON CONFLICT (feature_key) DO NOTHING;
