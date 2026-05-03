
-- 1. Columns on cs_tickets
ALTER TABLE public.cs_tickets
  ADD COLUMN IF NOT EXISTS assigned_mentor_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_mentor_name text,
  ADD COLUMN IF NOT EXISTS mentor_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS mentor_assigned_by uuid,
  ADD COLUMN IF NOT EXISTS mentor_evaluation_notes text,
  ADD COLUMN IF NOT EXISTS mentor_recommendation text,
  ADD COLUMN IF NOT EXISTS session_recordings jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. RLS — mentor can view assigned tickets
DROP POLICY IF EXISTS "Mentors view their assigned cs_tickets" ON public.cs_tickets;
CREATE POLICY "Mentors view their assigned cs_tickets"
  ON public.cs_tickets
  FOR SELECT
  TO authenticated
  USING (assigned_mentor_id = auth.uid());

-- 3. RLS — mentor can update only their evaluation fields
CREATE OR REPLACE FUNCTION public.cs_ticket_mentor_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the caller is admin/super_team_leader/team_leader, skip
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_team_leader'::app_role)
     OR public.has_role(auth.uid(), 'team_leader'::app_role) THEN
    RETURN NEW;
  END IF;

  -- If caller is the assigned mentor, only allow notes/recommendation change
  IF OLD.assigned_mentor_id = auth.uid() THEN
    IF NEW.ticket_number IS DISTINCT FROM OLD.ticket_number
       OR NEW.ticket_date IS DISTINCT FROM OLD.ticket_date
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.cs_category IS DISTINCT FROM OLD.cs_category
       OR NEW.edu_category IS DISTINCT FROM OLD.edu_category
       OR NEW.tutor_external_id IS DISTINCT FROM OLD.tutor_external_id
       OR NEW.tutor_name IS DISTINCT FROM OLD.tutor_name
       OR NEW.team_leader IS DISTINCT FROM OLD.team_leader
       OR NEW.case_details IS DISTINCT FROM OLD.case_details
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.session_num_or_date IS DISTINCT FROM OLD.session_num_or_date
       OR NEW.need_response_deadline IS DISTINCT FROM OLD.need_response_deadline
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.team_leader_response IS DISTINCT FROM OLD.team_leader_response
       OR NEW.assigned_mentor_id IS DISTINCT FROM OLD.assigned_mentor_id
       OR NEW.session_recordings IS DISTINCT FROM OLD.session_recordings
    THEN
      RAISE EXCEPTION 'Mentors can only update evaluation notes and recommendation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cs_ticket_mentor_update_guard_trg ON public.cs_tickets;
CREATE TRIGGER cs_ticket_mentor_update_guard_trg
BEFORE UPDATE ON public.cs_tickets
FOR EACH ROW EXECUTE FUNCTION public.cs_ticket_mentor_update_guard();

DROP POLICY IF EXISTS "Mentors update their assigned cs_tickets" ON public.cs_tickets;
CREATE POLICY "Mentors update their assigned cs_tickets"
  ON public.cs_tickets
  FOR UPDATE
  TO authenticated
  USING (assigned_mentor_id = auth.uid())
  WITH CHECK (assigned_mentor_id = auth.uid());

-- 4. RPC: list of mentors (id + name) — viewable by TL/admin/super
CREATE OR REPLACE FUNCTION public.list_available_mentors()
RETURNS TABLE(user_id uuid, full_name text, mentor_name text, team_leader text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.mentor_name, p.team_leader
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.user_id
  WHERE r.role IN ('mentor','community_moderator')
    AND COALESCE(p.active_status, true) = true
  ORDER BY p.full_name;
$$;

-- 5. RPC: tickets assigned to current mentor
CREATE OR REPLACE FUNCTION public.get_my_assigned_cs_tickets()
RETURNS SETOF public.cs_tickets
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT * FROM public.cs_tickets
  WHERE assigned_mentor_id = auth.uid()
  ORDER BY mentor_assigned_at DESC NULLS LAST, created_at DESC;
$$;

-- 6. Notify mentor on assignment
CREATE OR REPLACE FUNCTION public.notify_cs_ticket_mentor_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_mentor_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_mentor_id IS DISTINCT FROM OLD.assigned_mentor_id) THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (
      NEW.assigned_mentor_id,
      'cs_ticket_assigned',
      'You have been assigned CS ticket #' || NEW.ticket_number || ' for ' || NEW.tutor_name,
      '/performance'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_cs_ticket_mentor_assigned_trg ON public.cs_tickets;
CREATE TRIGGER notify_cs_ticket_mentor_assigned_trg
AFTER INSERT OR UPDATE OF assigned_mentor_id ON public.cs_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_cs_ticket_mentor_assigned();

-- 7. Storage bucket for recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('cs-recordings', 'cs-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — admins and team leaders manage; mentors read if assigned
DROP POLICY IF EXISTS "cs_recordings_admin_all" ON storage.objects;
CREATE POLICY "cs_recordings_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'cs-recordings' AND public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (bucket_id = 'cs-recordings' AND public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "cs_recordings_tl_all" ON storage.objects;
CREATE POLICY "cs_recordings_tl_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'cs-recordings' AND (public.has_role(auth.uid(),'team_leader'::app_role) OR public.has_role(auth.uid(),'super_team_leader'::app_role)))
  WITH CHECK (bucket_id = 'cs-recordings' AND (public.has_role(auth.uid(),'team_leader'::app_role) OR public.has_role(auth.uid(),'super_team_leader'::app_role)));

DROP POLICY IF EXISTS "cs_recordings_mentor_read" ON storage.objects;
CREATE POLICY "cs_recordings_mentor_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cs-recordings'
    AND EXISTS (
      SELECT 1 FROM public.cs_tickets t
      WHERE t.assigned_mentor_id = auth.uid()
        AND position(t.id::text in name) > 0
    )
  );
