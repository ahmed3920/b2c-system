
-- Tabs and option kinds
CREATE TYPE cms_review_tab AS ENUM ('need_to_improve', 'positive_comments', 'design');
CREATE TYPE cms_review_option_kind AS ENUM ('category', 'status', 'impact');

-- Admin-managed options (per tab + kind), with color
CREATE TABLE public.cms_review_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab cms_review_tab NOT NULL,
  kind cms_review_option_kind NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_review_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CMS admins manage review options"
ON public.cms_review_options FOR ALL TO authenticated
USING (has_cms_role(auth.uid(), 'cms_admin'::cms_app_role))
WITH CHECK (has_cms_role(auth.uid(), 'cms_admin'::cms_app_role));

CREATE POLICY "CMS users view active review options"
ON public.cms_review_options FOR SELECT TO authenticated
USING (is_cms_user(auth.uid()) AND (is_active = true OR has_cms_role(auth.uid(), 'cms_admin'::cms_app_role)));

-- Per-task review rows
CREATE TABLE public.cms_task_review_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  tab cms_review_tab NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  note text NOT NULL DEFAULT '',
  category_id uuid REFERENCES public.cms_review_options(id) ON DELETE SET NULL,
  status_id uuid REFERENCES public.cms_review_options(id) ON DELETE SET NULL,
  impact_id uuid REFERENCES public.cms_review_options(id) ON DELETE SET NULL,
  deliverable_url text,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cms_task_review_rows_task_tab_idx
  ON public.cms_task_review_rows(task_id, tab, display_order);

ALTER TABLE public.cms_task_review_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CMS admins manage all review rows"
ON public.cms_task_review_rows FOR ALL TO authenticated
USING (has_cms_role(auth.uid(), 'cms_admin'::cms_app_role))
WITH CHECK (has_cms_role(auth.uid(), 'cms_admin'::cms_app_role));

CREATE POLICY "CMS supervisors manage all review rows"
ON public.cms_task_review_rows FOR ALL TO authenticated
USING (has_cms_role(auth.uid(), 'cms_supervisor'::cms_app_role))
WITH CHECK (has_cms_role(auth.uid(), 'cms_supervisor'::cms_app_role));

CREATE POLICY "CMS users view review rows on accessible tasks"
ON public.cms_task_review_rows FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM cms_tasks t
  WHERE t.id = cms_task_review_rows.task_id
    AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
));

CREATE POLICY "CMS users insert review rows on accessible tasks"
ON public.cms_task_review_rows FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM cms_tasks t
  WHERE t.id = cms_task_review_rows.task_id
    AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
));

CREATE POLICY "CMS users update review rows on accessible tasks"
ON public.cms_task_review_rows FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM cms_tasks t
  WHERE t.id = cms_task_review_rows.task_id
    AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM cms_tasks t
  WHERE t.id = cms_task_review_rows.task_id
    AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
));

CREATE POLICY "CMS users delete review rows on accessible tasks"
ON public.cms_task_review_rows FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM cms_tasks t
  WHERE t.id = cms_task_review_rows.task_id
    AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
));

-- updated_at triggers
CREATE TRIGGER cms_review_options_updated_at
BEFORE UPDATE ON public.cms_review_options
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER cms_task_review_rows_updated_at
BEFORE UPDATE ON public.cms_task_review_rows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults matching screenshot for the 3 tabs
INSERT INTO public.cms_review_options (tab, kind, label, color, display_order) VALUES
  -- Categories
  ('need_to_improve','category','Completeness','#64748b',1),
  ('need_to_improve','category','Representation','#16a34a',2),
  ('need_to_improve','category','Consistency','#64748b',3),
  ('positive_comments','category','Completeness','#16a34a',1),
  ('positive_comments','category','Representation','#16a34a',2),
  ('positive_comments','category','Consistency','#16a34a',3),
  ('design','category','Visual','#0ea5e9',1),
  ('design','category','Layout','#6366f1',2),
  -- Statuses
  ('need_to_improve','status','Done','#16a34a',1),
  ('need_to_improve','status','Reported','#64748b',2),
  ('need_to_improve','status','Discarded','#dc2626',3),
  ('positive_comments','status','Acknowledged','#16a34a',1),
  ('positive_comments','status','Reported','#64748b',2),
  ('design','status','Done','#16a34a',1),
  ('design','status','In Progress','#0ea5e9',2),
  ('design','status','Reported','#64748b',3),
  -- Impact
  ('need_to_improve','impact','Minor','#64748b',1),
  ('need_to_improve','impact','Intermediate','#0ea5e9',2),
  ('need_to_improve','impact','Major','#dc2626',3),
  ('positive_comments','impact','Minor','#64748b',1),
  ('positive_comments','impact','Intermediate','#0ea5e9',2),
  ('positive_comments','impact','Major','#16a34a',3),
  ('design','impact','Minor','#64748b',1),
  ('design','impact','Intermediate','#0ea5e9',2),
  ('design','impact','Major','#dc2626',3);
