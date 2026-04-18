ALTER TABLE public.quality_uploads ADD COLUMN tutor_id text;
CREATE INDEX idx_quality_uploads_tutor_id ON public.quality_uploads(tutor_id);