-- Grant CS full-access users (Ghada, Kareem, mentors with ticket access)
-- the ability to view, edit, and delete session incidents, mirroring admin scope.

DROP POLICY IF EXISTS "CS full access view all incidents" ON public.session_incidents;
DROP POLICY IF EXISTS "CS full access update all incidents" ON public.session_incidents;
DROP POLICY IF EXISTS "CS full access delete all incidents" ON public.session_incidents;
DROP POLICY IF EXISTS "CS full access insert incidents" ON public.session_incidents;

CREATE POLICY "CS full access view all incidents"
ON public.session_incidents
FOR SELECT
TO authenticated
USING (public.has_cs_full_access(auth.uid()));

CREATE POLICY "CS full access update all incidents"
ON public.session_incidents
FOR UPDATE
TO authenticated
USING (public.has_cs_full_access(auth.uid()))
WITH CHECK (public.has_cs_full_access(auth.uid()));

CREATE POLICY "CS full access delete all incidents"
ON public.session_incidents
FOR DELETE
TO authenticated
USING (public.has_cs_full_access(auth.uid()));

CREATE POLICY "CS full access insert incidents"
ON public.session_incidents
FOR INSERT
TO authenticated
WITH CHECK (public.has_cs_full_access(auth.uid()));
