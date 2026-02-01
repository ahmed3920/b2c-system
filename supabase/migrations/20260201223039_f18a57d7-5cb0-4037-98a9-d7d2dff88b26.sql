-- Create a table to store task form field configurations (Admin configurable)
CREATE TABLE public.task_form_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_name TEXT NOT NULL UNIQUE,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text', -- text, textarea, date, select, file, number, url
  field_options JSONB, -- For select type: array of options like ["Option 1", "Option 2"]
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_system_field BOOLEAN NOT NULL DEFAULT false, -- System fields cannot be deleted
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_form_fields ENABLE ROW LEVEL SECURITY;

-- Only admins can manage form field configurations
CREATE POLICY "Admins can manage task form fields"
ON public.task_form_fields
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view active fields (needed for task form)
CREATE POLICY "Authenticated users can view active task form fields"
ON public.task_form_fields
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_task_form_fields_updated_at
BEFORE UPDATE ON public.task_form_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default system fields
INSERT INTO public.task_form_fields (field_name, field_label, field_type, is_required, is_system_field, display_order) VALUES
('task_type', 'Task Type', 'select', true, true, 1),
('description', 'Description', 'textarea', true, true, 2),
('priority', 'Priority', 'select', true, true, 3),
('date_from', 'Start Date', 'date', true, true, 4),
('date_to', 'Due Date', 'date', true, true, 5),
('status', 'Status', 'select', true, true, 6),
('related_link', 'Related Link', 'url', false, true, 7);

-- Update the task_form_fields with proper options for select fields
UPDATE public.task_form_fields 
SET field_options = '["One-to-One Meeting", "Study Plan", "Cover Session", "Team Meeting", "Parent Meeting", "Assessment", "Recap Session", "Session Review", "Check Flags", "Other"]'::jsonb
WHERE field_name = 'task_type';

UPDATE public.task_form_fields 
SET field_options = '[{"value": 1, "label": "Low"}, {"value": 2, "label": "Medium"}, {"value": 3, "label": "High"}, {"value": 4, "label": "Urgent"}]'::jsonb
WHERE field_name = 'priority';

UPDATE public.task_form_fields 
SET field_options = '[{"value": "todo", "label": "To-Do"}, {"value": "in_progress", "label": "In Progress"}, {"value": "done", "label": "Done"}]'::jsonb
WHERE field_name = 'status';