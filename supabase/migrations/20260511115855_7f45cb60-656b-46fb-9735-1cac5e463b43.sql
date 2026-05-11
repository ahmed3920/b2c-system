CREATE POLICY "CMS members create own tasks"
ON public.cms_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  is_cms_user(auth.uid())
  AND created_by = auth.uid()
  AND assignee_id = auth.uid()
);