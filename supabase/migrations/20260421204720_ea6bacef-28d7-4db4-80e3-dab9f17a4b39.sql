
-- 1. Categories table managed by admins
CREATE TABLE IF NOT EXISTS public.cs_ticket_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_type public.cs_ticket_case_type NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_type, name)
);

ALTER TABLE public.cs_ticket_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view active cs categories"
  ON public.cs_ticket_categories FOR SELECT
  TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage cs categories"
  ON public.cs_ticket_categories FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cs_ticket_categories_updated_at
  BEFORE UPDATE ON public.cs_ticket_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.cs_ticket_categories (case_type, name, display_order) VALUES
  ('CS', 'Session Engagement Complaint', 1),
  ('CS', 'Instructor attitude', 2),
  ('CS', 'Delaying start session', 3),
  ('CS', 'End session early', 4),
  ('CS', 'connection issue', 5),
  ('CS', 'Customer Request', 6),
  ('CS', 'Assessment parent meeting', 7),
  ('CS', 'Assessment', 8),
  ('CS', 'Delaying response - Community', 9),
  ('CS', 'General Issue', 10),
  ('Edu', 'Instructor attitude', 1),
  ('Edu', 'Delaying start session', 2),
  ('Edu', 'End session early', 3),
  ('Edu', 'Delaying response - Community', 4),
  ('Edu', 'Internet Connection Issue', 5),
  ('Edu', 'Way of Explanation', 6),
  ('Edu', 'Student Didn''t understand the session', 7),
  ('Edu', 'Missed Session Time Without Compensation', 8),
  ('Edu', 'Parent Request', 9),
  ('Edu', 'Instructor Unaware of Student Progress', 10),
  ('Edu', 'Removed student from meeting', 11),
  ('Edu', 'No progress; parent dissatisfied', 12),
  ('Edu', 'Poor pronunciation', 13),
  ('Edu', 'content related issue', 14),
  ('Edu', 'Inaccurate feedback', 15),
  ('Edu', 'didn''t complete content', 16),
  ('Edu', 'Special Case Request', 17),
  ('Edu', 'technical issue', 18),
  ('Edu', 'didn''t review tasks', 19),
  ('Edu', 'didn''t inform parent with presentation', 20),
  ('Edu', 'Late Feedback Submitting', 21),
  ('Edu', 'Tech Issue-System', 22)
ON CONFLICT (case_type, name) DO NOTHING;

-- 2. Multiple case types: array column
ALTER TABLE public.cs_tickets
  ADD COLUMN IF NOT EXISTS case_types public.cs_ticket_case_type[] NOT NULL DEFAULT '{}'::public.cs_ticket_case_type[];

-- Backfill from existing single case_type
UPDATE public.cs_tickets
SET case_types = ARRAY[case_type]
WHERE array_length(case_types, 1) IS NULL;

-- Add a check that at least one case type is set
ALTER TABLE public.cs_tickets
  DROP CONSTRAINT IF EXISTS cs_tickets_case_types_nonempty;
ALTER TABLE public.cs_tickets
  ADD CONSTRAINT cs_tickets_case_types_nonempty CHECK (array_length(case_types, 1) >= 1);

-- 3. Deadline with time
ALTER TABLE public.cs_tickets
  ALTER COLUMN need_response_deadline TYPE TIMESTAMPTZ
  USING (need_response_deadline::timestamptz);
