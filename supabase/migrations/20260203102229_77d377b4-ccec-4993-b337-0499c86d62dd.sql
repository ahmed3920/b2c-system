-- Drop the existing Admin policy that allows viewing all tasks
DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can insert any tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can update any tasks" ON public.tasks;

-- Create a security definer function for aggregated team stats (for Admin dashboard)
-- This allows Admins to see aggregated stats without direct task access
CREATE OR REPLACE FUNCTION public.get_team_task_stats()
RETURNS TABLE (
  team_leader text,
  total_tasks bigint,
  completed_tasks bigint,
  in_progress_tasks bigint,
  overdue_tasks bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.team_leader,
    COUNT(t.id) as total_tasks,
    COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status NOT IN ('done', 'archived') AND t.date_to < CURRENT_DATE THEN 1 END) as overdue_tasks
  FROM public.profiles p
  LEFT JOIN public.tasks t ON t.user_id = p.user_id
  GROUP BY p.team_leader
$$;