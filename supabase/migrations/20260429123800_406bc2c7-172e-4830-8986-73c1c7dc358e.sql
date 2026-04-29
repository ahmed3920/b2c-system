-- Edit history for action plan timeline steps (updates / sent emails recorded as steps)
CREATE TABLE public.action_plan_step_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid NOT NULL REFERENCES public.action_plan_steps(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL,
  editor_id uuid NOT NULL,
  editor_name text,
  previous_note text NOT NULL,
  new_note text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_plan_step_edits_step ON public.action_plan_step_edits(step_id, edited_at DESC);

ALTER TABLE public.action_plan_step_edits ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Admins manage all step edits"
  ON public.action_plan_step_edits FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Super team leaders manage everything
CREATE POLICY "Super team leaders manage all step edits"
  ON public.action_plan_step_edits FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_team_leader'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_team_leader'::app_role));

-- Team leaders can view + insert edits for steps belonging to their plans
CREATE POLICY "Team leaders view their step edits"
  ON public.action_plan_step_edits FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'team_leader'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.action_plans p
      WHERE p.id = action_plan_step_edits.plan_id
        AND p.team_leader = get_current_user_mentor_name()
    )
  );

CREATE POLICY "Team leaders insert their step edits"
  ON public.action_plan_step_edits FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'team_leader'::app_role)
    AND editor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.action_plans p
      WHERE p.id = action_plan_step_edits.plan_id
        AND p.team_leader = get_current_user_mentor_name()
    )
  );