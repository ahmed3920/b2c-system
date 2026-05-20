CREATE OR REPLACE FUNCTION public.is_user_in_my_team(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = _user_id
      AND public.team_leader_name_matches(
        p.team_leader,
        public.get_current_user_mentor_name()
      )
  )
$function$;

DROP POLICY IF EXISTS "Super team leaders can view team profiles" ON public.profiles;
CREATE POLICY "Super team leaders can view team profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_team_leader'::public.app_role)
  AND public.team_leader_name_matches(team_leader, public.get_current_user_mentor_name())
);

DROP POLICY IF EXISTS "Super team leaders can update team profiles" ON public.profiles;
CREATE POLICY "Super team leaders can update team profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_team_leader'::public.app_role)
  AND public.team_leader_name_matches(team_leader, public.get_current_user_mentor_name())
);

DROP POLICY IF EXISTS "Super team leaders can view team tasks" ON public.tasks;
CREATE POLICY "Super team leaders can view team tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_team_leader'::public.app_role)
  AND public.is_user_in_my_team(user_id)
);

DROP POLICY IF EXISTS "Super team leaders can update team tasks" ON public.tasks;
CREATE POLICY "Super team leaders can update team tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_team_leader'::public.app_role)
  AND public.is_user_in_my_team(user_id)
);

DROP POLICY IF EXISTS "Super team leaders can insert team tasks" ON public.tasks;
CREATE POLICY "Super team leaders can insert team tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_team_leader'::public.app_role)
  AND public.is_user_in_my_team(user_id)
);