
-- Comments for CMS tasks (Notion-style threads)
CREATE TYPE public.cms_task_comment_status AS ENUM ('open', 'resolved', 'needs_review');

CREATE TABLE public.cms_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  body TEXT NOT NULL,
  status public.cms_task_comment_status NOT NULL DEFAULT 'open',
  created_by UUID NOT NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cms_task_comments_task ON public.cms_task_comments(task_id);

ALTER TABLE public.cms_task_comments ENABLE ROW LEVEL SECURITY;

-- Anyone in CMS who can see the task can see/comment
CREATE POLICY "CMS admins manage all comments"
ON public.cms_task_comments FOR ALL TO authenticated
USING (public.has_cms_role(auth.uid(), 'cms_admin'))
WITH CHECK (public.has_cms_role(auth.uid(), 'cms_admin'));

CREATE POLICY "CMS supervisors manage all comments"
ON public.cms_task_comments FOR ALL TO authenticated
USING (public.has_cms_role(auth.uid(), 'cms_supervisor'))
WITH CHECK (public.has_cms_role(auth.uid(), 'cms_supervisor'));

CREATE POLICY "CMS members view comments on accessible tasks"
ON public.cms_task_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cms_tasks t
    WHERE t.id = cms_task_comments.task_id
      AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
  )
);

CREATE POLICY "CMS members insert comments on accessible tasks"
ON public.cms_task_comments FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.cms_tasks t
    WHERE t.id = cms_task_comments.task_id
      AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
  )
);

-- Anyone on the task can update status (per user request)
CREATE POLICY "CMS members update comment status on accessible tasks"
ON public.cms_task_comments FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cms_tasks t
    WHERE t.id = cms_task_comments.task_id
      AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cms_tasks t
    WHERE t.id = cms_task_comments.task_id
      AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
  )
);

CREATE TRIGGER trg_cms_task_comments_updated
BEFORE UPDATE ON public.cms_task_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
