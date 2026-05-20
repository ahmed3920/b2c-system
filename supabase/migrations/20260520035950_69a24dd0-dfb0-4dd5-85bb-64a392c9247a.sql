CREATE POLICY "Super team leaders can view team profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_team_leader'::app_role)
  AND team_leader = get_current_user_mentor_name()
);

CREATE POLICY "Super team leaders can update team profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_team_leader'::app_role)
  AND team_leader = get_current_user_mentor_name()
);