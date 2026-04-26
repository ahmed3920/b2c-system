
-- Allow team leaders to UPDATE only their own TODAY attendance (and only late_reason effectively)
CREATE POLICY "Team leaders update own today attendance"
ON public.team_leader_attendance
FOR UPDATE
TO authenticated
USING (
  team_leader_id = auth.uid()
  AND date = ((now() AT TIME ZONE 'Africa/Cairo'::text))::date
)
WITH CHECK (
  team_leader_id = auth.uid()
  AND date = ((now() AT TIME ZONE 'Africa/Cairo'::text))::date
);

-- Trigger to lock fields TL cannot change (only late_reason allowed for TL self-update)
CREATE OR REPLACE FUNCTION public.protect_attendance_tl_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin can change anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Self-edit guard: TLs can only modify late_reason
  IF auth.uid() = OLD.team_leader_id THEN
    IF NEW.team_leader_id IS DISTINCT FROM OLD.team_leader_id
       OR NEW.date IS DISTINCT FROM OLD.date
       OR NEW.check_in_time IS DISTINCT FROM OLD.check_in_time
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.minutes_late IS DISTINCT FROM OLD.minutes_late
       OR NEW.team_leader_name IS DISTINCT FROM OLD.team_leader_name THEN
      RAISE EXCEPTION 'Team leaders can only update the late reason on their own record';
    END IF;
    -- Also enforce: the row must be today's row (extra guard beyond RLS)
    IF OLD.date <> ((now() AT TIME ZONE 'Africa/Cairo'::text))::date THEN
      RAISE EXCEPTION 'Past attendance records are locked';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_attendance_tl_update ON public.team_leader_attendance;
CREATE TRIGGER trg_protect_attendance_tl_update
BEFORE UPDATE ON public.team_leader_attendance
FOR EACH ROW
EXECUTE FUNCTION public.protect_attendance_tl_update();

-- Trigger to keep updated_at fresh
DROP TRIGGER IF EXISTS trg_attendance_updated_at ON public.team_leader_attendance;
CREATE TRIGGER trg_attendance_updated_at
BEFORE UPDATE ON public.team_leader_attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function: send pre-9:30 reminder to TLs without a check-in yet today
CREATE OR REPLACE FUNCTION public.notify_tl_checkin_reminder()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  the_date DATE := (now() AT TIME ZONE 'Africa/Cairo')::date;
  inserted_count INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT p.user_id
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role IN ('team_leader','super_team_leader')
      AND COALESCE(p.active_status, true) = true
      AND NOT EXISTS (
        SELECT 1 FROM public.team_leader_attendance a
        WHERE a.team_leader_id = p.user_id AND a.date = the_date
      )
  LOOP
    -- Avoid duplicate reminders within the same day
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = rec.user_id
        AND n.type = 'attendance_reminder'
        AND n.created_at::date = the_date
    ) THEN
      INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (
        rec.user_id,
        'attendance_reminder',
        '⏰ Reminder: Check-in opens at 9:30 AM. Don''t forget to check in today.',
        '/attendance'
      );
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;
  RETURN inserted_count;
END;
$$;

-- Schedule reminder at 09:15 Cairo time (UTC+2 → 07:15 UTC) every day
-- Ensure pg_cron extension is available
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tl-checkin-reminder-daily') THEN
    PERFORM cron.unschedule('tl-checkin-reminder-daily');
  END IF;
  PERFORM cron.schedule(
    'tl-checkin-reminder-daily',
    '15 7 * * *',
    $cron$ SELECT public.notify_tl_checkin_reminder(); $cron$
  );
END
$$;
