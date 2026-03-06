
-- Create task categories table
CREATE TABLE public.task_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  category_name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(role, category_name)
);

-- Enable RLS
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage task categories"
ON public.task_categories FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can read active categories
CREATE POLICY "Users can view active categories"
ON public.task_categories FOR SELECT
TO authenticated
USING (is_active = true);

-- Updated_at trigger
CREATE TRIGGER update_task_categories_updated_at
  BEFORE UPDATE ON public.task_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed default mentor categories
INSERT INTO public.task_categories (role, category_name, display_order, is_default) VALUES
('mentor', 'One-to-One Meeting', 1, true),
('mentor', 'Study Plan', 2, true),
('mentor', 'Cover Session', 3, true),
('mentor', 'Team Meeting', 4, true),
('mentor', 'Parent Meeting', 5, true),
('mentor', 'Assessment', 6, true),
('mentor', 'Recap Session', 7, true),
('mentor', 'Session Review', 8, true),
('mentor', 'Check Flags', 9, true),
('mentor', 'Other', 10, true);

-- Seed default team_leader categories
INSERT INTO public.task_categories (role, category_name, display_order, is_default) VALUES
('team_leader', 'One-to-one meeting', 1, true),
('team_leader', 'Team Meeting', 2, true),
('team_leader', 'Sub-Team Meeting', 3, true),
('team_leader', 'Batch Training', 4, true),
('team_leader', 'Study plan', 5, true),
('team_leader', 'Validating CS Case', 6, true),
('team_leader', 'Validating Flags', 7, true),
('team_leader', 'Session review', 8, true),
('team_leader', 'Process Development', 9, true),
('team_leader', 'Assigning Tasks to Mentors', 10, true),
('team_leader', 'Following Up with Mentors', 11, true),
('team_leader', 'Mentors Filtration', 12, true),
('team_leader', 'Mentors KPIs', 13, true),
('team_leader', 'Tutors KPIs', 14, true),
('team_leader', 'Team Upgrades', 15, true),
('team_leader', 'Moderation Validation', 16, true),
('team_leader', 'Other', 17, true);

-- Seed default admin categories (same as mentor defaults)
INSERT INTO public.task_categories (role, category_name, display_order, is_default) VALUES
('admin', 'One-to-One Meeting', 1, true),
('admin', 'Study Plan', 2, true),
('admin', 'Cover Session', 3, true),
('admin', 'Team Meeting', 4, true),
('admin', 'Parent Meeting', 5, true),
('admin', 'Assessment', 6, true),
('admin', 'Recap Session', 7, true),
('admin', 'Session Review', 8, true),
('admin', 'Check Flags', 9, true),
('admin', 'Other', 10, true);

-- Seed default community_moderator categories (same as mentor)
INSERT INTO public.task_categories (role, category_name, display_order, is_default) VALUES
('community_moderator', 'One-to-One Meeting', 1, true),
('community_moderator', 'Study Plan', 2, true),
('community_moderator', 'Cover Session', 3, true),
('community_moderator', 'Team Meeting', 4, true),
('community_moderator', 'Parent Meeting', 5, true),
('community_moderator', 'Assessment', 6, true),
('community_moderator', 'Recap Session', 7, true),
('community_moderator', 'Session Review', 8, true),
('community_moderator', 'Check Flags', 9, true),
('community_moderator', 'Other', 10, true);
