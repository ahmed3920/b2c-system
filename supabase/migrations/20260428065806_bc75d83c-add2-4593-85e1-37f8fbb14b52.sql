CREATE OR REPLACE FUNCTION public.protect_attendance_tl_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Admin can change anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Self-edit guard for team leaders
  IF auth.uid() = OLD.team_leader_id THEN
    -- The row must be today's row
    IF OLD.date <> ((now() AT TIME ZONE 'Africa/Cairo'::text))::date THEN
      RAISE EXCEPTION 'Past attendance records are locked';
    END IF;

    -- Allow the initial check-in: transitioning from no check_in_time to a check_in_time today.
    -- In this case the TL may set check_in_time, status, minutes_late, late_reason, team_leader_name.
    IF OLD.check_in_time IS NULL AND NEW.check_in_time IS NOT NULL THEN
      IF NEW.team_leader_id IS DISTINCT FROM OLD.team_leader_id
         OR NEW.date IS DISTINCT FROM OLD.date THEN
        RAISE EXCEPTION 'Cannot change team leader id or date';
      END IF;
      RETURN NEW;
    END IF;

    -- Otherwise (already checked in): only late_reason may change
    IF NEW.team_leader_id IS DISTINCT FROM OLD.team_leader_id
       OR NEW.date IS DISTINCT FROM OLD.date
       OR NEW.check_in_time IS DISTINCT FROM OLD.check_in_time
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.minutes_late IS DISTINCT FROM OLD.minutes_late
       OR NEW.team_leader_name IS DISTINCT FROM OLD.team_leader_name THEN
      RAISE EXCEPTION 'Team leaders can only update the late reason on their own record';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;