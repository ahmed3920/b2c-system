-- 1. SELECT: allow team_leader AND super_team_leader, with fuzzy name match
DROP POLICY IF EXISTS "Team leaders view their team issues" ON public.live_session_issues;
CREATE POLICY "Team leaders view their team issues"
ON public.live_session_issues
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND public.team_leader_name_matches(team_leader, public.get_current_user_mentor_name())
);

-- 2. UPDATE: same expansion
DROP POLICY IF EXISTS "Team leaders update edu fields for their team" ON public.live_session_issues;
CREATE POLICY "Team leaders update edu fields for their team"
ON public.live_session_issues
FOR UPDATE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND public.team_leader_name_matches(team_leader, public.get_current_user_mentor_name())
)
WITH CHECK (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND public.team_leader_name_matches(team_leader, public.get_current_user_mentor_name())
);

-- 3. Audit table: allow super_team_leader view too, with fuzzy match
DROP POLICY IF EXISTS "TL view audit for their team" ON public.live_session_issue_audit;
CREATE POLICY "TL view audit for their team"
ON public.live_session_issue_audit
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.live_session_issues i
    WHERE i.id = live_session_issue_audit.issue_id
      AND public.team_leader_name_matches(i.team_leader, public.get_current_user_mentor_name())
  )
);