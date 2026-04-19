-- Add new enum values for action_plan_category
ALTER TYPE public.action_plan_category ADD VALUE IF NOT EXISTS 'emergency_abuse';
ALTER TYPE public.action_plan_category ADD VALUE IF NOT EXISTS 'no_show_abuse';