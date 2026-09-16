-- Quality Team: read-only access to all CS tickets and all quality data
CREATE POLICY "Quality team view all cs_tickets" ON public.cs_tickets
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'quality_team'::public.app_role));

CREATE POLICY "Quality team view all cs ticket audit" ON public.cs_ticket_audit
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'quality_team'::public.app_role));

CREATE POLICY "Quality team view quality uploads" ON public.quality_uploads
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'quality_team'::public.app_role));

CREATE POLICY "Quality team view quality flag followups" ON public.quality_flag_followups
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'quality_team'::public.app_role));

CREATE POLICY "Quality team view project audit decisions" ON public.project_audit_decisions
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'quality_team'::public.app_role));

CREATE POLICY "Quality team view project evaluations" ON public.project_evaluations
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'quality_team'::public.app_role));

CREATE POLICY "Quality team view project review assignments" ON public.project_review_assignments
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'quality_team'::public.app_role));

CREATE POLICY "Quality team view project upload snapshots" ON public.project_upload_snapshots
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'quality_team'::public.app_role));