
-- Grant 4 specific mentors full access to CS tickets (view all + create)
CREATE TABLE IF NOT EXISTS public.cs_ticket_full_access (
  user_id uuid PRIMARY KEY,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid
);

ALTER TABLE public.cs_ticket_full_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cs_ticket_full_access"
  ON public.cs_ticket_full_access FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users see their own full-access flag"
  ON public.cs_ticket_full_access FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_cs_full_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.cs_ticket_full_access WHERE user_id = _user_id)
$$;

-- Allow these users to SELECT all cs_tickets
CREATE POLICY "CS full-access users view all cs_tickets"
  ON public.cs_tickets FOR SELECT
  TO authenticated
  USING (public.has_cs_full_access(auth.uid()));

-- Allow these users to INSERT cs_tickets
CREATE POLICY "CS full-access users insert cs_tickets"
  ON public.cs_tickets FOR INSERT
  TO authenticated
  WITH CHECK (public.has_cs_full_access(auth.uid()));

-- Allow them to view related audit and categories already public
CREATE POLICY "CS full-access users view cs_ticket_audit"
  ON public.cs_ticket_audit FOR SELECT
  TO authenticated
  USING (public.has_cs_full_access(auth.uid()));

-- Seed the 4 mentors
INSERT INTO public.cs_ticket_full_access (user_id) VALUES
  ('960005ff-dee1-4a44-8c11-33e13cb8ed4f'),
  ('0ecf324e-ffdf-4215-ad89-fc52bf3228bc'),
  ('62fc27fe-1a6a-4924-95ee-dd0d236b012f'),
  ('de7faacf-ca78-400f-911e-bbdcb9a821b5')
ON CONFLICT (user_id) DO NOTHING;
