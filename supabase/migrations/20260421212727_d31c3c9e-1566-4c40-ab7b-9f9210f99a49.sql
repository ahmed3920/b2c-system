CREATE TABLE public.feature_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  route_path text,
  enabled_admin boolean NOT NULL DEFAULT true,
  enabled_super_team_leader boolean NOT NULL DEFAULT true,
  enabled_team_leader boolean NOT NULL DEFAULT true,
  enabled_mentor boolean NOT NULL DEFAULT true,
  enabled_community_moderator boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_controls_order ON public.feature_controls(display_order);

ALTER TABLE public.feature_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read feature_controls"
ON public.feature_controls
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage feature_controls"
ON public.feature_controls
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_feature_controls_updated_at
BEFORE UPDATE ON public.feature_controls
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed existing app sections
INSERT INTO public.feature_controls (feature_key, name, description, route_path, display_order,
  enabled_admin, enabled_super_team_leader, enabled_team_leader, enabled_mentor, enabled_community_moderator)
VALUES
  ('home', 'Home', 'Main landing dashboard', '/home', 10, true, true, true, true, true),
  ('tasks', 'Tasks', 'Task management', '/tasks', 20, true, true, true, true, true),
  ('kanban', 'Kanban', 'Kanban board view', '/kanban', 30, true, true, true, true, true),
  ('progress', 'Progress', 'Personal progress', '/progress', 40, true, true, true, true, true),
  ('reports', 'Reports', 'Reports & analytics', '/reports', 50, true, true, true, false, false),
  ('action_plans', 'Action Plans', 'Tutor action plans', '/action-plans', 60, true, true, true, false, false),
  ('engagement', 'Engagement', 'Tutor engagement', '/engagement', 70, true, true, true, false, false),
  ('dashboard', 'Dashboard', 'B2C dashboard overview', '/dashboard', 80, true, true, true, false, false),
  ('tutors', 'Tutors', 'Tutor directory', '/tutors', 90, true, true, true, false, false),
  ('teams', 'Teams', 'Teams overview', '/teams', 100, true, true, true, false, false),
  ('performance', 'Performance', 'Live issues & CS tickets', '/performance', 110, true, true, true, false, false),
  ('tracking', 'Tracking', 'Tracking & quality', '/tracking', 120, true, true, true, false, false),
  ('growth', 'Growth', 'Growth metrics', '/growth', 130, true, true, true, false, false),
  ('risk_control', 'Risk Control', 'Risk control center', '/risk-control', 140, true, true, true, false, false),
  ('study_plan', 'Study Plan', 'Weekly study plans', '/study-plan', 150, true, true, true, false, false),
  ('team_dashboard', 'Team Dashboard', 'Team leader dashboard', '/team/dashboard', 160, true, true, true, false, false),
  ('admin_dashboard', 'Admin Dashboard', 'System dashboard', '/admin/dashboard', 200, true, false, false, false, false),
  ('admin_users', 'User Management', 'Manage users & roles', '/admin/users', 210, true, false, false, false, false),
  ('admin_announcements', 'Announcements Admin', 'Manage announcements', '/admin/announcements', 220, true, false, false, false, false),
  ('admin_feature_plans', 'Feature Plans', 'Roadmap & feature plans', '/admin/feature-plans', 230, true, false, false, false, false),
  ('admin_edu_descriptions', 'Edu Descriptions', 'Manage Edu descriptions', '/admin/edu-descriptions', 240, true, false, false, false, false),
  ('admin_cs_ticket_categories', 'CS Ticket Categories', 'Manage CS categories', '/admin/cs-ticket-categories', 250, true, false, false, false, false);