
-- action_plan_tutors: allow super_team_leader to view all tutors
CREATE POLICY "Super team leaders view all tutors"
ON public.action_plan_tutors
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_team_leader'::app_role));

-- action_plans: allow super_team_leader to manage all plans
CREATE POLICY "Super team leaders manage all action plans"
ON public.action_plans
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_team_leader'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_team_leader'::app_role));

-- action_plan_steps: allow super_team_leader to manage steps for all plans
CREATE POLICY "Super team leaders manage all steps"
ON public.action_plan_steps
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_team_leader'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_team_leader'::app_role));
