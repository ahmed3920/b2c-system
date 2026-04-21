
-- Tutors table for CS Ticket lookups
CREATE TABLE IF NOT EXISTS public.tutors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_external_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  team_leader TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutors_full_name ON public.tutors (full_name);
CREATE INDEX IF NOT EXISTS idx_tutors_team_leader ON public.tutors (team_leader);

ALTER TABLE public.tutors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tutors"
  ON public.tutors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage tutors"
  ON public.tutors FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_tutors_updated_at
  BEFORE UPDATE ON public.tutors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CS Ticket case type enum
CREATE TYPE public.cs_ticket_case_type AS ENUM ('CS', 'Edu');
CREATE TYPE public.cs_ticket_status AS ENUM ('Pending', 'Validated', 'Rejected');

-- Sequence for human-readable ticket numbers
CREATE SEQUENCE IF NOT EXISTS public.cs_ticket_number_seq START 1000;

-- CS Tickets table
CREATE TABLE IF NOT EXISTS public.cs_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE DEFAULT ('CS-' || lpad(nextval('public.cs_ticket_number_seq')::text, 6, '0')),
  ticket_date DATE NOT NULL DEFAULT CURRENT_DATE,
  case_type public.cs_ticket_case_type NOT NULL,
  category TEXT NOT NULL,
  tutor_id UUID NOT NULL REFERENCES public.tutors(id) ON DELETE RESTRICT,
  tutor_external_id TEXT NOT NULL,
  tutor_name TEXT NOT NULL,
  team_leader TEXT NOT NULL,
  case_details TEXT,
  student_id TEXT,
  session_num_or_date TEXT,
  need_response_deadline DATE,
  status public.cs_ticket_status NOT NULL DEFAULT 'Pending',
  team_leader_response TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cs_tickets_status ON public.cs_tickets (status);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_case_type ON public.cs_tickets (case_type);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_team_leader ON public.cs_tickets (team_leader);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_ticket_date ON public.cs_tickets (ticket_date DESC);

ALTER TABLE public.cs_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all cs_tickets"
  ON public.cs_tickets FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team leaders view their cs_tickets"
  ON public.cs_tickets FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'team_leader'::app_role) AND team_leader = get_current_user_mentor_name());

CREATE POLICY "Team leaders update their cs_tickets"
  ON public.cs_tickets FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'team_leader'::app_role) AND team_leader = get_current_user_mentor_name())
  WITH CHECK (has_role(auth.uid(), 'team_leader'::app_role) AND team_leader = get_current_user_mentor_name());

CREATE POLICY "Authenticated can insert cs_tickets"
  ON public.cs_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER update_cs_tickets_updated_at
  BEFORE UPDATE ON public.cs_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
