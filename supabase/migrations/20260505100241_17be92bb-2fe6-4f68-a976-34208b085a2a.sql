ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60;
ALTER TABLE public.trainings ALTER COLUMN training_time DROP NOT NULL;