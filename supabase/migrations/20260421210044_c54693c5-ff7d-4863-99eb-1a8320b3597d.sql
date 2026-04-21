
-- Drop auto-generated default for ticket_number (uniqueness already enforced)
ALTER TABLE public.cs_tickets
  ALTER COLUMN ticket_number DROP DEFAULT;

-- Replace broad insert policy
DROP POLICY IF EXISTS "Authenticated can insert cs_tickets" ON public.cs_tickets;

CREATE POLICY "Admins and super team leaders insert cs_tickets"
ON public.cs_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_team_leader'::app_role)
);

-- Super team leaders see and update everything
CREATE POLICY "Super team leaders view all cs_tickets"
ON public.cs_tickets
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_team_leader'::app_role));

CREATE POLICY "Super team leaders update all cs_tickets"
ON public.cs_tickets
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_team_leader'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_team_leader'::app_role));
