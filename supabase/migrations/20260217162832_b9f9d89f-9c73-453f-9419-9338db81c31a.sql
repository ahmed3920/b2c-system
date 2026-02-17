-- Allow admins to view all tasks across the system
CREATE POLICY "Admins can view all tasks"
ON public.tasks
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update any task
CREATE POLICY "Admins can update all tasks"
ON public.tasks
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert tasks for any user
CREATE POLICY "Admins can insert tasks for any user"
ON public.tasks
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete any task
CREATE POLICY "Admins can delete all tasks"
ON public.tasks
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));