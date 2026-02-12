
-- Add optional time range and duration columns to tasks
ALTER TABLE public.tasks
ADD COLUMN start_time text,
ADD COLUMN end_time text,
ADD COLUMN duration_minutes integer;
