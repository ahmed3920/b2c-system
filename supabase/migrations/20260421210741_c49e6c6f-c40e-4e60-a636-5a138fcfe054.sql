-- Allow admins and super team leaders to delete CS tickets
CREATE POLICY "Admins delete cs_tickets"
ON public.cs_tickets
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super team leaders delete cs_tickets"
ON public.cs_tickets
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_team_leader'::app_role));