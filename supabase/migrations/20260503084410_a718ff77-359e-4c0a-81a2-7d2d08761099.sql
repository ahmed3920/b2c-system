DROP POLICY IF EXISTS "Authenticated view active incident categories" ON public.session_incident_categories;
CREATE POLICY "Anyone can view active incident categories" ON public.session_incident_categories FOR SELECT TO anon, authenticated USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated view incident field config" ON public.session_incident_field_config;
CREATE POLICY "Anyone can view incident field config" ON public.session_incident_field_config FOR SELECT TO anon, authenticated USING (true);