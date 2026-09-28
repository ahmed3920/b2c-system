DROP POLICY IF EXISTS "Team leaders manage their action plans" ON public.action_plans;
DROP POLICY IF EXISTS "Super team leaders manage their action plans" ON public.action_plans;
CREATE POLICY "Team leaders manage their action plans" ON public.action_plans FOR ALL TO authenticated
USING (has_role(auth.uid(), 'team_leader'::app_role) AND team_leader_name_matches(team_leader, get_current_user_mentor_name()))
WITH CHECK (has_role(auth.uid(), 'team_leader'::app_role) AND team_leader_name_matches(team_leader, get_current_user_mentor_name()));
CREATE POLICY "Super team leaders manage their action plans" ON public.action_plans FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_team_leader'::app_role) AND team_leader_name_matches(team_leader, get_current_user_mentor_name()))
WITH CHECK (has_role(auth.uid(), 'super_team_leader'::app_role) AND team_leader_name_matches(team_leader, get_current_user_mentor_name()));

DROP POLICY IF EXISTS "Team leaders manage steps for their plans" ON public.action_plan_steps;
DROP POLICY IF EXISTS "Super team leaders manage steps for their plans" ON public.action_plan_steps;
CREATE POLICY "Team leaders manage steps for their plans" ON public.action_plan_steps FOR ALL TO authenticated
USING (has_role(auth.uid(), 'team_leader'::app_role) AND EXISTS (SELECT 1 FROM public.action_plans p WHERE p.id = action_plan_steps.plan_id AND team_leader_name_matches(p.team_leader, get_current_user_mentor_name())))
WITH CHECK (has_role(auth.uid(), 'team_leader'::app_role) AND EXISTS (SELECT 1 FROM public.action_plans p WHERE p.id = action_plan_steps.plan_id AND team_leader_name_matches(p.team_leader, get_current_user_mentor_name())));
CREATE POLICY "Super team leaders manage steps for their plans" ON public.action_plan_steps FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_team_leader'::app_role) AND EXISTS (SELECT 1 FROM public.action_plans p WHERE p.id = action_plan_steps.plan_id AND team_leader_name_matches(p.team_leader, get_current_user_mentor_name())))
WITH CHECK (has_role(auth.uid(), 'super_team_leader'::app_role) AND EXISTS (SELECT 1 FROM public.action_plans p WHERE p.id = action_plan_steps.plan_id AND team_leader_name_matches(p.team_leader, get_current_user_mentor_name())));

DROP POLICY IF EXISTS "Team leaders insert their step edits" ON public.action_plan_step_edits;
DROP POLICY IF EXISTS "Team leaders view their step edits" ON public.action_plan_step_edits;
DROP POLICY IF EXISTS "Super team leaders insert their step edits" ON public.action_plan_step_edits;
DROP POLICY IF EXISTS "Super team leaders view their step edits" ON public.action_plan_step_edits;
CREATE POLICY "Team leaders insert their step edits" ON public.action_plan_step_edits FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'team_leader'::app_role) AND editor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.action_plans p WHERE p.id = action_plan_step_edits.plan_id AND team_leader_name_matches(p.team_leader, get_current_user_mentor_name())));
CREATE POLICY "Team leaders view their step edits" ON public.action_plan_step_edits FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'team_leader'::app_role) AND EXISTS (SELECT 1 FROM public.action_plans p WHERE p.id = action_plan_step_edits.plan_id AND team_leader_name_matches(p.team_leader, get_current_user_mentor_name())));
CREATE POLICY "Super team leaders insert their step edits" ON public.action_plan_step_edits FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_team_leader'::app_role) AND editor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.action_plans p WHERE p.id = action_plan_step_edits.plan_id AND team_leader_name_matches(p.team_leader, get_current_user_mentor_name())));
CREATE POLICY "Super team leaders view their step edits" ON public.action_plan_step_edits FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_team_leader'::app_role) AND EXISTS (SELECT 1 FROM public.action_plans p WHERE p.id = action_plan_step_edits.plan_id AND team_leader_name_matches(p.team_leader, get_current_user_mentor_name())));