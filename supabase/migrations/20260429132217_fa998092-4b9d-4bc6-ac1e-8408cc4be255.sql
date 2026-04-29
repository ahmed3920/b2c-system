-- Restrict super team leaders to only their own team's action plans (like regular team leaders)

DROP POLICY IF EXISTS "Super team leaders manage all action plans" ON public.action_plans;
DROP POLICY IF EXISTS "Super team leaders manage all steps" ON public.action_plan_steps;
DROP POLICY IF EXISTS "Super team leaders manage all step edits" ON public.action_plan_step_edits;
DROP POLICY IF EXISTS "Super team leaders view all tutors" ON public.action_plan_tutors;

-- action_plans: super TL only their own team
CREATE POLICY "Super team leaders manage their action plans"
ON public.action_plans
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_team_leader'::app_role) AND team_leader = public.get_current_user_mentor_name())
WITH CHECK (public.has_role(auth.uid(), 'super_team_leader'::app_role) AND team_leader = public.get_current_user_mentor_name());

-- action_plan_steps: super TL only steps for plans on their team
CREATE POLICY "Super team leaders manage steps for their plans"
ON public.action_plan_steps
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_team_leader'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.action_plans p
    WHERE p.id = action_plan_steps.plan_id
      AND p.team_leader = public.get_current_user_mentor_name()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_team_leader'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.action_plans p
    WHERE p.id = action_plan_steps.plan_id
      AND p.team_leader = public.get_current_user_mentor_name()
  )
);

-- action_plan_step_edits: super TL only edits for plans on their team
CREATE POLICY "Super team leaders view their step edits"
ON public.action_plan_step_edits
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_team_leader'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.action_plans p
    WHERE p.id = action_plan_step_edits.plan_id
      AND p.team_leader = public.get_current_user_mentor_name()
  )
);

CREATE POLICY "Super team leaders insert their step edits"
ON public.action_plan_step_edits
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_team_leader'::app_role)
  AND editor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.action_plans p
    WHERE p.id = action_plan_step_edits.plan_id
      AND p.team_leader = public.get_current_user_mentor_name()
  )
);

-- action_plan_tutors: super TL only tutors on their team
CREATE POLICY "Super team leaders view their tutors"
ON public.action_plan_tutors
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_team_leader'::app_role) AND team_leader = public.get_current_user_mentor_name());