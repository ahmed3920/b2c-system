-- Add display title to user roles + extend assignee role enum
ALTER TABLE public.cms_user_roles
  ADD COLUMN IF NOT EXISTS title text;

-- Extend the task-assignee role enum with 'senior_developer' and 'team_leader'
ALTER TYPE public.cms_task_assignee_role ADD VALUE IF NOT EXISTS 'senior_developer';
ALTER TYPE public.cms_task_assignee_role ADD VALUE IF NOT EXISTS 'team_leader';