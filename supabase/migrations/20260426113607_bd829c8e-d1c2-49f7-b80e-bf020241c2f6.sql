-- 1. Status enum
CREATE TYPE public.attendance_status AS ENUM ('on_time', 'late', 'absent');

-- 2. Attendance table
CREATE TABLE public.team_leader_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_leader_id UUID NOT NULL,
  team_leader_name TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIMESTAMPTZ,
  status public.attendance_status NOT NULL DEFAULT 'absent',
  minutes_late INTEGER NOT NULL DEFAULT 0,
  late_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_leader_attendance_unique_day UNIQUE (team_leader_id, date)
);

CREATE INDEX idx_tla_date ON public.team_leader_attendance(date DESC);
CREATE INDEX idx_tla_tl_date ON public.team_leader_attendance(team_leader_id, date DESC);

-- 3. updated_at trigger
CREATE TRIGGER trg_tla_set_updated_at
BEFORE UPDATE ON public.team_leader_attendance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. RLS
ALTER TABLE public.team_leader_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all attendance"
ON public.team_leader_attendance
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team leaders view own attendance"
ON public.team_leader_attendance
FOR SELECT
TO authenticated
USING (
  team_leader_id = auth.uid()
);

CREATE POLICY "Super team leaders view all attendance"
ON public.team_leader_attendance
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_team_leader'::app_role));

CREATE POLICY "Team leaders insert own attendance"
ON public.team_leader_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  team_leader_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'team_leader'::app_role)
    OR public.has_role(auth.uid(), 'super_team_leader'::app_role)
  )
  AND date = (now() AT TIME ZONE 'Africa/Cairo')::date
);

-- 5. Auto-absent function: marks any TL/Super TL without a row for the given date as absent.
CREATE OR REPLACE FUNCTION public.mark_absent_team_leaders(_target_date DATE DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  the_date DATE := COALESCE(_target_date, (now() AT TIME ZONE 'Africa/Cairo')::date);
  inserted_count INTEGER := 0;
BEGIN
  WITH eligible AS (
    SELECT DISTINCT p.user_id, p.full_name
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role IN ('team_leader', 'super_team_leader')
      AND COALESCE(p.active_status, true) = true
  ),
  ins AS (
    INSERT INTO public.team_leader_attendance
      (team_leader_id, team_leader_name, date, status, minutes_late, check_in_time)
    SELECT e.user_id, e.full_name, the_date, 'absent'::attendance_status, 0, NULL
    FROM eligible e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.team_leader_attendance a
      WHERE a.team_leader_id = e.user_id AND a.date = the_date
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO inserted_count FROM ins;
  RETURN inserted_count;
END;
$$;

-- 6. Enable required extensions for cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;