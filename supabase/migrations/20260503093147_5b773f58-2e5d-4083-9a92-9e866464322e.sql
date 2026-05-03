
ALTER TABLE public.session_incidents
  ADD COLUMN IF NOT EXISTS cs_ticket_number text,
  ADD COLUMN IF NOT EXISTS cs_response text,
  ADD COLUMN IF NOT EXISTS cs_status text;
