CREATE TABLE public.study_plan_sheet_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sheet_kind TEXT NOT NULL UNIQUE,   -- upcoming_sessions | pre_modules | ended_sessions | post_modules
  csv_url TEXT,
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_plan_sheet_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sheet configs"
ON public.study_plan_sheet_configs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_spsc_updated
BEFORE UPDATE ON public.study_plan_sheet_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed empty rows for each kind
INSERT INTO public.study_plan_sheet_configs (sheet_kind, column_mapping) VALUES
  ('upcoming_sessions', '{"tutor_external_id":"tutor_external_id","tutor_name":"tutor_name","team_leader":"team_leader","scheduled_sessions":"scheduled_sessions"}'::jsonb),
  ('pre_modules',       '{"tutor_external_id":"tutor_external_id","tutor_name":"tutor_name","team_leader":"team_leader","grade_band":"grade_band","module_code":"module_code","is_finished":"is_finished"}'::jsonb),
  ('ended_sessions',    '{"tutor_external_id":"tutor_external_id","tutor_name":"tutor_name","team_leader":"team_leader","scheduled_sessions":"scheduled_sessions"}'::jsonb),
  ('post_modules',      '{"tutor_external_id":"tutor_external_id","tutor_name":"tutor_name","team_leader":"team_leader","grade_band":"grade_band","module_code":"module_code","is_finished":"is_finished"}'::jsonb);