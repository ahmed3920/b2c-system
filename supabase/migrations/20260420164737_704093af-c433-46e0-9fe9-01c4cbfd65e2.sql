CREATE TABLE public.tutor_leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_external_id text NOT NULL,
  tutor_name text,
  team_leader text,
  leave_date date NOT NULL,
  source text DEFAULT 'sheet',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tutor_external_id, leave_date)
);

CREATE INDEX idx_tutor_leaves_tutor ON public.tutor_leaves(tutor_external_id);
CREATE INDEX idx_tutor_leaves_date ON public.tutor_leaves(leave_date);

ALTER TABLE public.tutor_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all leaves"
ON public.tutor_leaves FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "TL view team leaves"
ON public.tutor_leaves FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'team_leader'::app_role)
  AND (
    team_leader = get_current_user_mentor_name()
    OR EXISTS (
      SELECT 1 FROM public.tutor_weekly_occupation o
      WHERE o.tutor_external_id = tutor_leaves.tutor_external_id
        AND o.team_leader = get_current_user_mentor_name()
    )
  )
);

CREATE TRIGGER trg_tutor_leaves_updated
BEFORE UPDATE ON public.tutor_leaves
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();