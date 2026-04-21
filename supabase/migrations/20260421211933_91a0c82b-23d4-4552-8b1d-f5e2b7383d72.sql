-- Audit table for cs_tickets changes
CREATE TABLE public.cs_ticket_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  ticket_number text NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_ticket_audit_ticket_id ON public.cs_ticket_audit(ticket_id);
CREATE INDEX idx_cs_ticket_audit_created_at ON public.cs_ticket_audit(created_at DESC);

ALTER TABLE public.cs_ticket_audit ENABLE ROW LEVEL SECURITY;

-- Insert: any authenticated user can insert their own audit row
CREATE POLICY "Authenticated insert cs ticket audit"
ON public.cs_ticket_audit
FOR INSERT
TO authenticated
WITH CHECK (changed_by = auth.uid());

-- Admins view all
CREATE POLICY "Admins view all cs ticket audit"
ON public.cs_ticket_audit
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Super team leaders view all
CREATE POLICY "Super team leaders view all cs ticket audit"
ON public.cs_ticket_audit
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_team_leader'::app_role));

-- Team leaders view audit for their own tickets
CREATE POLICY "Team leaders view their cs ticket audit"
ON public.cs_ticket_audit
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'team_leader'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cs_tickets t
    WHERE t.id = cs_ticket_audit.ticket_id
      AND team_leader_name_matches(t.team_leader, get_current_user_mentor_name())
  )
);