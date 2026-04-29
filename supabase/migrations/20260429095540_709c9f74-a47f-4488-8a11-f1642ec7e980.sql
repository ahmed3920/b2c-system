-- Team Leader emails directory (admin-managed)
CREATE TABLE IF NOT EXISTS public.team_leader_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_leader_name text NOT NULL UNIQUE,
  email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_leader_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage team_leader_emails"
ON public.team_leader_emails
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view team_leader_emails"
ON public.team_leader_emails
FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER trg_team_leader_emails_updated_at
BEFORE UPDATE ON public.team_leader_emails
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend email_logs to track sender meta if needed (already has sent_by/sent_by_name; add reply_to/from)
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS reply_to text,
  ADD COLUMN IF NOT EXISTS from_email text,
  ADD COLUMN IF NOT EXISTS error_message text;