
-- Reference table storing each tutor's two weekend (off) days.
-- Day names are lowercase strings like 'wednesday', 'thursday', 'friday', 'saturday'.
CREATE TABLE IF NOT EXISTS public.tutor_weekend_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_external_id TEXT NOT NULL UNIQUE,
  tutor_name TEXT,
  team_leader TEXT,
  weekend_days TEXT[] NOT NULL DEFAULT '{}'::text[],
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_weekend_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tutor weekend days"
ON public.tutor_weekend_days
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view tutor weekend days"
ON public.tutor_weekend_days
FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER set_tutor_weekend_days_updated_at
BEFORE UPDATE ON public.tutor_weekend_days
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tutor_weekend_days_ext ON public.tutor_weekend_days(tutor_external_id);
