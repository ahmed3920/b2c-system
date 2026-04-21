
ALTER TYPE public.cs_ticket_status ADD VALUE IF NOT EXISTS 'Valid';
ALTER TYPE public.cs_ticket_status ADD VALUE IF NOT EXISTS 'Not Valid';
ALTER TYPE public.cs_ticket_status ADD VALUE IF NOT EXISTS 'Not a Complain';
