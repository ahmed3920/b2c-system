CREATE POLICY "CS full-access users update cs_tickets"
ON public.cs_tickets
FOR UPDATE
TO authenticated
USING (has_cs_full_access(auth.uid()))
WITH CHECK (has_cs_full_access(auth.uid()));