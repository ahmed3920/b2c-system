
ALTER TABLE public.tutor_leaves
  ADD COLUMN IF NOT EXISTS leave_reason text,
  ADD COLUMN IF NOT EXISTS leave_rule_id text,
  ADD COLUMN IF NOT EXISTS is_mentor boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS effective_days numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_request boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS language text;

CREATE INDEX IF NOT EXISTS idx_tutor_leaves_reason ON public.tutor_leaves(leave_reason);
CREATE INDEX IF NOT EXISTS idx_tutor_leaves_is_request ON public.tutor_leaves(is_request);
