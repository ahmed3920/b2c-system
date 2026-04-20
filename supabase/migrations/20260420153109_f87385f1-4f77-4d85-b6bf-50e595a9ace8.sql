-- ============================================================
-- Weekly Study Plan – Phase 1 schema
-- ============================================================

-- 1. Module catalog ------------------------------------------------
CREATE TABLE public.study_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grade_band TEXT NOT NULL,         -- e.g. 'Grade 1 - 2'
  module_code TEXT NOT NULL,        -- 'M1' | 'M2' | 'M3' | 'M4'
  hours_required NUMERIC(4,1) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (grade_band, module_code)
);

ALTER TABLE public.study_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view modules"
ON public.study_modules FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage modules"
ON public.study_modules FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_study_modules_updated
BEFORE UPDATE ON public.study_modules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the 24 modules
INSERT INTO public.study_modules (grade_band, module_code, hours_required, display_order) VALUES
('Grade 1 - 2','M1',2,1),('Grade 1 - 2','M2',2,2),('Grade 1 - 2','M3',2,3),('Grade 1 - 2','M4',3,4),
('Grade 3 - 4','M1',2,5),('Grade 3 - 4','M2',2,6),('Grade 3 - 4','M3',2,7),('Grade 3 - 4','M4',3,8),
('Grade 5 - 6','M1',3,9),('Grade 5 - 6','M2',4,10),('Grade 5 - 6','M3',3,11),('Grade 5 - 6','M4',4,12),
('Grade 7 - 8','M1',3,13),('Grade 7 - 8','M2',5,14),('Grade 7 - 8','M3',5,15),('Grade 7 - 8','M4',6,16),
('Grade 9 - 10','M1',5,17),('Grade 9 - 10','M2',5,18),('Grade 9 - 10','M3',6,19),('Grade 9 - 10','M4',6,20),
('Grade 11 - 12','M1',5,21),('Grade 11 - 12','M2',5,22),('Grade 11 - 12','M3',6,23),('Grade 11 - 12','M4',6,24);

-- 2. Tutor weekly occupation --------------------------------------
CREATE TABLE public.tutor_weekly_occupation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_external_id TEXT NOT NULL,
  tutor_name TEXT NOT NULL,
  team_leader TEXT NOT NULL,
  week_start DATE NOT NULL,
  phase TEXT NOT NULL DEFAULT 'pre',  -- 'pre' | 'post'
  scheduled_sessions INTEGER NOT NULL DEFAULT 0,
  free_hours NUMERIC(5,1) GENERATED ALWAYS AS (GREATEST(0, 25 - scheduled_sessions)) STORED,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tutor_external_id, week_start, phase)
);

CREATE INDEX idx_two_week ON public.tutor_weekly_occupation (week_start);
CREATE INDEX idx_two_tl ON public.tutor_weekly_occupation (team_leader);

ALTER TABLE public.tutor_weekly_occupation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage occupation"
ON public.tutor_weekly_occupation FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "TL view team occupation"
ON public.tutor_weekly_occupation FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'team_leader'::app_role) AND team_leader = get_current_user_mentor_name());

CREATE TRIGGER trg_two_updated
BEFORE UPDATE ON public.tutor_weekly_occupation
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tutor published modules --------------------------------------
CREATE TABLE public.tutor_published_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_external_id TEXT NOT NULL,
  tutor_name TEXT NOT NULL,
  team_leader TEXT NOT NULL,
  week_start DATE NOT NULL,
  phase TEXT NOT NULL DEFAULT 'pre',  -- 'pre' | 'post'
  module_id UUID NOT NULL REFERENCES public.study_modules(id) ON DELETE CASCADE,
  is_assigned BOOLEAN NOT NULL DEFAULT TRUE,
  is_finished BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tutor_external_id, week_start, phase, module_id)
);

CREATE INDEX idx_tpm_week ON public.tutor_published_modules (week_start);
CREATE INDEX idx_tpm_tl ON public.tutor_published_modules (team_leader);

ALTER TABLE public.tutor_published_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage published modules"
ON public.tutor_published_modules FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "TL view team published modules"
ON public.tutor_published_modules FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'team_leader'::app_role) AND team_leader = get_current_user_mentor_name());

CREATE TRIGGER trg_tpm_updated
BEFORE UPDATE ON public.tutor_published_modules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Weekly study plans (header) ----------------------------------
CREATE TABLE public.weekly_study_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_external_id TEXT NOT NULL,
  tutor_name TEXT NOT NULL,
  team_leader TEXT NOT NULL,
  week_start DATE NOT NULL,
  free_hours NUMERIC(5,1) NOT NULL DEFAULT 0,
  planned_hours NUMERIC(5,1) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',   -- 'draft' | 'published' | 'reconciled'
  notes TEXT,
  generated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tutor_external_id, week_start)
);

CREATE INDEX idx_wsp_week ON public.weekly_study_plans (week_start);
CREATE INDEX idx_wsp_tl ON public.weekly_study_plans (team_leader);

ALTER TABLE public.weekly_study_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage plans"
ON public.weekly_study_plans FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "TL view team plans"
ON public.weekly_study_plans FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'team_leader'::app_role) AND team_leader = get_current_user_mentor_name());

CREATE POLICY "TL insert team plans"
ON public.weekly_study_plans FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'team_leader'::app_role) AND team_leader = get_current_user_mentor_name());

CREATE POLICY "TL update team plans"
ON public.weekly_study_plans FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'team_leader'::app_role) AND team_leader = get_current_user_mentor_name());

CREATE TRIGGER trg_wsp_updated
BEFORE UPDATE ON public.weekly_study_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Weekly study plan items --------------------------------------
CREATE TABLE public.weekly_study_plan_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.weekly_study_plans(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.study_modules(id) ON DELETE CASCADE,
  planned_hours NUMERIC(4,1) NOT NULL,
  is_partial BOOLEAN NOT NULL DEFAULT FALSE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, module_id)
);

CREATE INDEX idx_wspi_plan ON public.weekly_study_plan_items (plan_id);

ALTER TABLE public.weekly_study_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage plan items"
ON public.weekly_study_plan_items FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "TL view team plan items"
ON public.weekly_study_plan_items FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'team_leader'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.weekly_study_plans p
    WHERE p.id = weekly_study_plan_items.plan_id
      AND p.team_leader = get_current_user_mentor_name()
  )
);

CREATE POLICY "TL manage team plan items"
ON public.weekly_study_plan_items FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'team_leader'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.weekly_study_plans p
    WHERE p.id = weekly_study_plan_items.plan_id
      AND p.team_leader = get_current_user_mentor_name()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'team_leader'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.weekly_study_plans p
    WHERE p.id = weekly_study_plan_items.plan_id
      AND p.team_leader = get_current_user_mentor_name()
  )
);

CREATE TRIGGER trg_wspi_updated
BEFORE UPDATE ON public.weekly_study_plan_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();