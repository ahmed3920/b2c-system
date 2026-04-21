
-- 1) Add a 'link' column for deep-linking from the bell
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link text;

-- Allow trigger-based system inserts (security definer functions bypass RLS,
-- but we add a permissive insert policy as well so service role / cron can write).
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2) Helper: find user_ids of team leaders whose mentor_name fuzzy-matches
CREATE OR REPLACE FUNCTION public.find_team_leader_user_ids(_team_leader_name text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id
  FROM public.profiles p
  JOIN public.user_roles r ON r.user_id = p.user_id
  WHERE r.role IN ('team_leader', 'super_team_leader')
    AND public.team_leader_name_matches(_team_leader_name, p.mentor_name);
$$;

-- 3) Trigger: new CS ticket → notify matching team leaders
CREATE OR REPLACE FUNCTION public.notify_new_cs_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tl_user_id uuid;
BEGIN
  FOR tl_user_id IN
    SELECT public.find_team_leader_user_ids(NEW.team_leader)
  LOOP
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (
      tl_user_id,
      'cs_ticket_new',
      'New CS ticket #' || NEW.ticket_number || ' for ' || NEW.tutor_name || ' needs validation',
      '/risk-control'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_cs_ticket ON public.cs_tickets;
CREATE TRIGGER trg_notify_new_cs_ticket
AFTER INSERT ON public.cs_tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_cs_ticket();

-- 4) Trigger: new live session issue → notify team leader if not already validated
CREATE OR REPLACE FUNCTION public.notify_new_live_issue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tl_user_id uuid;
BEGIN
  -- Only notify when freshly synced and not yet validated
  IF NEW.edu_validation IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR tl_user_id IN
    SELECT public.find_team_leader_user_ids(NEW.team_leader)
  LOOP
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (
      tl_user_id,
      'live_issue_new',
      'New live session case ' || NEW.case_id || ' needs validation',
      '/tracking'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_live_issue ON public.live_session_issues;
CREATE TRIGGER trg_notify_new_live_issue
AFTER INSERT ON public.live_session_issues
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_live_issue();

-- 5) Daily 8 AM job: scan tickets due today and create alerts
-- Use a uniqueness guard so re-runs don't duplicate.
CREATE OR REPLACE FUNCTION public.notify_tickets_due_today()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
  rec record;
  tl_user_id uuid;
  msg text;
BEGIN
  FOR rec IN
    SELECT * FROM public.cs_tickets
    WHERE need_response_deadline IS NOT NULL
      AND need_response_deadline::date = CURRENT_DATE
      AND status = 'Pending'
  LOOP
    msg := 'Ticket #' || rec.ticket_number || ' (' || rec.tutor_name || ') is due today';
    FOR tl_user_id IN SELECT public.find_team_leader_user_ids(rec.team_leader)
    LOOP
      -- Skip if already notified today for this ticket
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = tl_user_id
          AND n.type = 'cs_ticket_due_today'
          AND n.message = msg
          AND n.created_at::date = CURRENT_DATE
      ) THEN
        INSERT INTO public.notifications (user_id, type, message, link)
        VALUES (tl_user_id, 'cs_ticket_due_today', msg, '/risk-control');
        inserted_count := inserted_count + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN inserted_count;
END;
$$;

-- 6) Schedule it daily at 08:00 UTC via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any previous schedule with same name
DO $$
BEGIN
  PERFORM cron.unschedule('notify-tickets-due-today');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'notify-tickets-due-today',
  '0 8 * * *',
  $$ SELECT public.notify_tickets_due_today(); $$
);
