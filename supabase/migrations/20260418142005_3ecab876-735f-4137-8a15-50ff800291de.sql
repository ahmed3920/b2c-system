-- Tracking Numbers: Quality uploads table
CREATE TABLE public.quality_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  team_leader text NOT NULL,
  session_date date,
  score numeric NOT NULL,
  uploaded_by uuid NOT NULL,
  scope text NOT NULL DEFAULT 'team', -- 'team' for team_leader uploads, 'admin' for admin uploads
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quality_uploads_uploaded_by ON public.quality_uploads(uploaded_by);
CREATE INDEX idx_quality_uploads_team_leader ON public.quality_uploads(team_leader);
CREATE INDEX idx_quality_uploads_agent_name ON public.quality_uploads(agent_name);

ALTER TABLE public.quality_uploads ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins manage all quality uploads"
ON public.quality_uploads
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Team leaders: manage rows they uploaded (replace-on-upload pattern)
CREATE POLICY "Team leaders manage their own quality uploads"
ON public.quality_uploads
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'team_leader'::app_role) AND uploaded_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'team_leader'::app_role) AND uploaded_by = auth.uid());
