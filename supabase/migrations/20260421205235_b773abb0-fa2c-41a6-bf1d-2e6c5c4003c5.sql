
ALTER TABLE public.cs_tickets
  ADD COLUMN IF NOT EXISTS cs_category TEXT,
  ADD COLUMN IF NOT EXISTS edu_category TEXT;

-- Backfill: put existing category into whichever side(s) the ticket already has
UPDATE public.cs_tickets
SET cs_category = COALESCE(cs_category, category)
WHERE 'CS' = ANY(case_types) AND cs_category IS NULL;

UPDATE public.cs_tickets
SET edu_category = COALESCE(edu_category, category)
WHERE 'Edu' = ANY(case_types) AND edu_category IS NULL;
