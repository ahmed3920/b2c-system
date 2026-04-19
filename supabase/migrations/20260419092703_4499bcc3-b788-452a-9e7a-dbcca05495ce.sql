ALTER TABLE public.action_plans
  ADD COLUMN IF NOT EXISTS quality_baseline_score numeric,
  ADD COLUMN IF NOT EXISTS quality_month1_score numeric,
  ADD COLUMN IF NOT EXISTS quality_month2_score numeric,
  ADD COLUMN IF NOT EXISTS quality_month3_score numeric;