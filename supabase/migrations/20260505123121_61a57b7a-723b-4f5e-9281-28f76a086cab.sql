
CREATE TABLE IF NOT EXISTS public.cms_task_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_task_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CMS admins manage task categories"
ON public.cms_task_categories FOR ALL TO authenticated
USING (has_cms_role(auth.uid(), 'cms_admin'::cms_app_role))
WITH CHECK (has_cms_role(auth.uid(), 'cms_admin'::cms_app_role));

CREATE POLICY "CMS users view active task categories"
ON public.cms_task_categories FOR SELECT TO authenticated
USING (is_cms_user(auth.uid()) AND (is_active = true OR has_cms_role(auth.uid(), 'cms_admin'::cms_app_role)));

CREATE TRIGGER cms_task_categories_updated_at
BEFORE UPDATE ON public.cms_task_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cms_tasks
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.cms_task_categories(id) ON DELETE SET NULL;

INSERT INTO public.cms_task_categories (name, color, display_order) VALUES
  ('Article', '#3b82f6', 1),
  ('Video', '#ef4444', 2),
  ('Social Post', '#22c55e', 3),
  ('Design', '#a855f7', 4)
ON CONFLICT DO NOTHING;
