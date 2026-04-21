
ALTER TABLE public.cs_tickets DROP CONSTRAINT IF EXISTS cs_tickets_tutor_id_fkey;
ALTER TABLE public.cs_tickets DROP COLUMN IF EXISTS tutor_id;
DROP TABLE IF EXISTS public.tutors;
