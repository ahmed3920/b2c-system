-- Status enum for documentation
CREATE TYPE public.feature_doc_status AS ENUM ('planned', 'in_progress', 'completed', 'needs_review');

-- Main documentation table
CREATE TABLE public.feature_documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  functionalities TEXT[] NOT NULL DEFAULT '{}',
  user_roles TEXT[] NOT NULL DEFAULT '{}',
  status feature_doc_status NOT NULL DEFAULT 'needs_review',
  how_it_works TEXT NOT NULL DEFAULT '',
  ui_explanation TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  screenshots TEXT[] NOT NULL DEFAULT '{}',
  route_path TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_documentation_module ON public.feature_documentation(module);
CREATE INDEX idx_feature_documentation_status ON public.feature_documentation(status);

ALTER TABLE public.feature_documentation ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Admins manage feature_documentation"
ON public.feature_documentation
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view docs
CREATE POLICY "Authenticated view feature_documentation"
ON public.feature_documentation
FOR SELECT
TO authenticated
USING (true);

-- Updated_at trigger
CREATE TRIGGER update_feature_documentation_updated_at
BEFORE UPDATE ON public.feature_documentation
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('feature-docs', 'feature-docs', true);

-- Storage policies
CREATE POLICY "Public read feature-docs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'feature-docs');

CREATE POLICY "Admins upload feature-docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'feature-docs' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update feature-docs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'feature-docs' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete feature-docs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'feature-docs' AND public.has_role(auth.uid(), 'admin'::app_role));