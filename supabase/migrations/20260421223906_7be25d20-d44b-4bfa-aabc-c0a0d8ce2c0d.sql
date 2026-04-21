-- Allow super_team_leader to view & manage their team's weekly study plan data,
-- mirroring the existing team_leader access. Without this, users with only
-- the super_team_leader role can't see plans, items, occupation, leaves, or
-- published modules for their team.

-- weekly_study_plans
DROP POLICY IF EXISTS "TL view team plans" ON public.weekly_study_plans;
CREATE POLICY "TL view team plans"
ON public.weekly_study_plans
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND team_leader = public.get_current_user_mentor_name()
);

DROP POLICY IF EXISTS "TL insert team plans" ON public.weekly_study_plans;
CREATE POLICY "TL insert team plans"
ON public.weekly_study_plans
FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND team_leader = public.get_current_user_mentor_name()
);

DROP POLICY IF EXISTS "TL update team plans" ON public.weekly_study_plans;
CREATE POLICY "TL update team plans"
ON public.weekly_study_plans
FOR UPDATE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND team_leader = public.get_current_user_mentor_name()
);

-- weekly_study_plan_items
DROP POLICY IF EXISTS "TL view team plan items" ON public.weekly_study_plan_items;
CREATE POLICY "TL view team plan items"
ON public.weekly_study_plan_items
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.weekly_study_plans p
    WHERE p.id = weekly_study_plan_items.plan_id
      AND p.team_leader = public.get_current_user_mentor_name()
  )
);

DROP POLICY IF EXISTS "TL manage team plan items" ON public.weekly_study_plan_items;
CREATE POLICY "TL manage team plan items"
ON public.weekly_study_plan_items
FOR ALL
TO authenticated
USING (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.weekly_study_plans p
    WHERE p.id = weekly_study_plan_items.plan_id
      AND p.team_leader = public.get_current_user_mentor_name()
  )
)
WITH CHECK (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.weekly_study_plans p
    WHERE p.id = weekly_study_plan_items.plan_id
      AND p.team_leader = public.get_current_user_mentor_name()
  )
);

-- tutor_weekly_occupation
DROP POLICY IF EXISTS "TL view team occupation" ON public.tutor_weekly_occupation;
CREATE POLICY "TL view team occupation"
ON public.tutor_weekly_occupation
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND team_leader = public.get_current_user_mentor_name()
);

-- tutor_published_modules
DROP POLICY IF EXISTS "TL view team published modules" ON public.tutor_published_modules;
CREATE POLICY "TL view team published modules"
ON public.tutor_published_modules
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND team_leader = public.get_current_user_mentor_name()
);

-- tutor_leaves
DROP POLICY IF EXISTS "TL view team leaves" ON public.tutor_leaves;
CREATE POLICY "TL view team leaves"
ON public.tutor_leaves
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
  AND (
    team_leader = public.get_current_user_mentor_name()
    OR EXISTS (
      SELECT 1 FROM public.tutor_weekly_occupation o
      WHERE o.tutor_external_id = tutor_leaves.tutor_external_id
        AND o.team_leader = public.get_current_user_mentor_name()
    )
  )
);
