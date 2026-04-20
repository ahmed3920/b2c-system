-- Clean leftover sample data
DELETE FROM public.weekly_study_plan_items
WHERE plan_id IN (
  SELECT id FROM public.weekly_study_plans
  WHERE tutor_external_id LIKE 'SAMPLE-%'
);

DELETE FROM public.weekly_study_plans
WHERE tutor_external_id LIKE 'SAMPLE-%';

DELETE FROM public.tutor_published_modules
WHERE tutor_external_id LIKE 'SAMPLE-%';

DELETE FROM public.tutor_weekly_occupation
WHERE source = 'sample' OR tutor_external_id LIKE 'SAMPLE-%';