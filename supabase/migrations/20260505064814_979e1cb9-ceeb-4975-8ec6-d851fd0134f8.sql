-- Enums
CREATE TYPE public.cms_task_assignee_role AS ENUM ('developer', 'reviewer');
CREATE TYPE public.cms_task_property_type AS ENUM ('text','number','select','multi_select','date','url','person','checkbox','percent');

-- Multi-assignees
CREATE TABLE public.cms_task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role public.cms_task_assignee_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id, role)
);
CREATE INDEX idx_cms_task_assignees_task ON public.cms_task_assignees(task_id);
ALTER TABLE public.cms_task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CMS admins manage assignees"
ON public.cms_task_assignees FOR ALL TO authenticated
USING (public.has_cms_role(auth.uid(),'cms_admin'))
WITH CHECK (public.has_cms_role(auth.uid(),'cms_admin'));

CREATE POLICY "CMS supervisors manage assignees"
ON public.cms_task_assignees FOR ALL TO authenticated
USING (public.has_cms_role(auth.uid(),'cms_supervisor'))
WITH CHECK (public.has_cms_role(auth.uid(),'cms_supervisor'));

CREATE POLICY "CMS users view assignees on accessible tasks"
ON public.cms_task_assignees FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.cms_tasks t
    WHERE t.id = cms_task_assignees.task_id
      AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
  )
);

-- Comment attachments
ALTER TABLE public.cms_task_comments
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cms-comment-attachments','cms-comment-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "CMS users read comment attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cms-comment-attachments'
  AND public.is_cms_user(auth.uid())
);

CREATE POLICY "CMS users upload comment attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cms-comment-attachments'
  AND public.is_cms_user(auth.uid())
);

CREATE POLICY "CMS users delete own comment attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'cms-comment-attachments'
  AND (
    owner = auth.uid()
    OR public.has_cms_role(auth.uid(),'cms_admin')
    OR public.has_cms_role(auth.uid(),'cms_supervisor')
  )
);

-- Custom property definitions
CREATE TABLE public.cms_task_property_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  type public.cms_task_property_type NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb, -- for select/multi_select: [{value,label,color?}]
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cms_task_property_defs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CMS admins manage property defs"
ON public.cms_task_property_defs FOR ALL TO authenticated
USING (public.has_cms_role(auth.uid(),'cms_admin'))
WITH CHECK (public.has_cms_role(auth.uid(),'cms_admin'));

CREATE POLICY "CMS users view property defs"
ON public.cms_task_property_defs FOR SELECT TO authenticated
USING (public.is_cms_user(auth.uid()));

-- Property values
CREATE TABLE public.cms_task_property_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  prop_id uuid NOT NULL REFERENCES public.cms_task_property_defs(id) ON DELETE CASCADE,
  value jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, prop_id)
);
CREATE INDEX idx_cms_task_property_values_task ON public.cms_task_property_values(task_id);
ALTER TABLE public.cms_task_property_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CMS admins manage property values"
ON public.cms_task_property_values FOR ALL TO authenticated
USING (public.has_cms_role(auth.uid(),'cms_admin'))
WITH CHECK (public.has_cms_role(auth.uid(),'cms_admin'));

CREATE POLICY "CMS supervisors manage property values"
ON public.cms_task_property_values FOR ALL TO authenticated
USING (public.has_cms_role(auth.uid(),'cms_supervisor'))
WITH CHECK (public.has_cms_role(auth.uid(),'cms_supervisor'));

CREATE POLICY "CMS users view property values on accessible tasks"
ON public.cms_task_property_values FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cms_tasks t
    WHERE t.id = cms_task_property_values.task_id
      AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
  )
);

CREATE POLICY "CMS users edit property values on owned/assigned tasks"
ON public.cms_task_property_values FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cms_tasks t
    WHERE t.id = cms_task_property_values.task_id
      AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
  )
);

CREATE POLICY "CMS users update property values on owned/assigned tasks"
ON public.cms_task_property_values FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cms_tasks t
    WHERE t.id = cms_task_property_values.task_id
      AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cms_tasks t
    WHERE t.id = cms_task_property_values.task_id
      AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
  )
);

-- updated_at triggers
CREATE TRIGGER trg_cms_task_property_defs_updated
BEFORE UPDATE ON public.cms_task_property_defs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_cms_task_property_values_updated
BEFORE UPDATE ON public.cms_task_property_values
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults matching the screenshot
INSERT INTO public.cms_task_property_defs (key, label, type, options, display_order) VALUES
 ('google_drive_link','Google-Drive-Link','url','[]'::jsonb, 10),
 ('archived_deliverables','Archived Deliverables','url','[]'::jsonb, 20),
 ('grade_semester','Grade - Semester','select','[{"value":"G3-S1","label":"G3-S1"},{"value":"G3-S2","label":"G3-S2"},{"value":"G4-S1","label":"G4-S1"},{"value":"G4-S2","label":"G4-S2"}]'::jsonb, 30),
 ('type','Type','select','[{"value":"Teacher Guide","label":"Teacher Guide"},{"value":"Student Book","label":"Student Book"},{"value":"Slides","label":"Slides"}]'::jsonb, 40),
 ('completed_completion','Completed completion','percent','[]'::jsonb, 50),
 ('lesson_key','Lesson Key','text','[]'::jsonb, 60),
 ('lessons','Lessons','text','[]'::jsonb, 70),
 ('theme','Theme','text','[]'::jsonb, 80),
 ('grade','Grade','select','[{"value":"Grade 01","label":"Grade 01"},{"value":"Grade 02","label":"Grade 02"},{"value":"Grade 03","label":"Grade 03"},{"value":"Grade 04","label":"Grade 04"}]'::jsonb, 90),
 ('is_dev_late','is_dev_late','checkbox','[]'::jsonb, 100)
ON CONFLICT (key) DO NOTHING;