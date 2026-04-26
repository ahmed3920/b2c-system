-- Enums
CREATE TYPE public.announcement_audience AS ENUM ('team_leaders', 'mentors', 'both');
CREATE TYPE public.announcement_priority AS ENUM ('important', 'normal');
CREATE TYPE public.announcement_status AS ENUM ('published', 'draft');

CREATE TYPE public.feature_module AS ENUM (
  'Tasks','Action Plans','Engagement','Tracking','Reports','User Management','Announcements','Other'
);
CREATE TYPE public.feature_plan_status AS ENUM ('planned','in_progress','completed','blocked');
CREATE TYPE public.feature_plan_visibility AS ENUM ('team_leaders','mentors','both','hidden');

-- Announcements
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  audience public.announcement_audience NOT NULL DEFAULT 'both',
  date timestamptz NOT NULL DEFAULT now(),
  priority public.announcement_priority NOT NULL DEFAULT 'normal',
  status public.announcement_status NOT NULL DEFAULT 'published',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view published announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (status = 'published'::public.announcement_status OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Feature plans
CREATE TABLE public.feature_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  module public.feature_module NOT NULL DEFAULT 'Other',
  status public.feature_plan_status NOT NULL DEFAULT 'planned',
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  assigned_to text NOT NULL DEFAULT '',
  target_release timestamptz NOT NULL DEFAULT now(),
  visibility public.feature_plan_visibility NOT NULL DEFAULT 'both',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage feature_plans"
  ON public.feature_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view non-hidden feature_plans"
  ON public.feature_plans FOR SELECT TO authenticated
  USING (visibility <> 'hidden'::public.feature_plan_visibility OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_feature_plans_updated_at
  BEFORE UPDATE ON public.feature_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial data
INSERT INTO public.announcements (title, description, audience, date, priority, status) VALUES
  ('Q2 Performance Review Window Open',
   'The Q2 performance review window is now open. Team Leaders please complete all mentor reviews by the end of the month to ensure timely feedback and goal-setting for the next quarter.',
   'team_leaders', now(), 'important', 'published'),
  ('New Session Logging Guidelines',
   'Please review the updated session logging guidelines available in the knowledge base. All mentors are required to log session notes within 24 hours of each session.',
   'mentors', now() - interval '2 days', 'normal', 'published'),
  ('Platform Maintenance Window — Friday 10pm',
   'Scheduled maintenance on Friday from 10pm to 11pm. The platform may be briefly unavailable during this window. Please plan your sessions accordingly.',
   'both', now() - interval '1 day', 'important', 'published'),
  ('Monthly All-Hands Recording Available',
   'The recording from this month''s all-hands meeting is now available in the shared drive. Highlights include the new growth roadmap and updates from the product team.',
   'both', now() - interval '5 days', 'normal', 'published');

INSERT INTO public.feature_plans (name, description, module, status, progress, assigned_to, target_release, visibility) VALUES
  ('Bulk Task Assignment',
   'Assign tasks to multiple mentors at once from the Admin dashboard with templates and recurring schedules.',
   'Tasks', 'in_progress', 65, 'Product Team', now() + interval '21 days', 'both'),
  ('Mentor Engagement Heatmap',
   'Visual heatmap showing student engagement trends over time, segmented by mentor and subject.',
   'Engagement', 'planned', 10, 'Analytics Team', now() + interval '45 days', 'team_leaders'),
  ('Action Plan Templates Library',
   'A library of pre-built action plan templates that mentors can quickly adopt and customize.',
   'Action Plans', 'completed', 100, 'Sarah K.', now() - interval '7 days', 'mentors'),
  ('Weekly Performance Reports Export',
   'Automated PDF export of weekly performance reports delivered via email to Team Leaders.',
   'Reports', 'blocked', 30, 'Mohammed R.', now() + interval '60 days', 'both'),
  ('Internal QA Dashboard',
   'Internal tooling for the QA team — not user-facing.',
   'Other', 'in_progress', 40, 'QA Team', now() + interval '30 days', 'hidden');