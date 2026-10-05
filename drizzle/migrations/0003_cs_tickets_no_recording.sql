ALTER TABLE public.cs_tickets
  ADD COLUMN IF NOT EXISTS no_recording boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_recording_note text,
  ADD COLUMN IF NOT EXISTS no_recording_marked_by uuid,
  ADD COLUMN IF NOT EXISTS no_recording_marked_at timestamptz;