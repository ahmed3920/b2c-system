-- Helper: fuzzy match between two names (token-subset, case/whitespace insensitive)
CREATE OR REPLACE FUNCTION public.team_leader_name_matches(_candidate text, _mine text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  a text;
  b text;
  at text[];
  bt text[];
  short_t text[];
  long_t text[];
  tok text;
BEGIN
  IF _candidate IS NULL OR _mine IS NULL THEN RETURN false; END IF;
  a := lower(regexp_replace(_candidate, '[^[:alnum:][:space:]]', ' ', 'g'));
  a := regexp_replace(a, '\s+', ' ', 'g');
  a := btrim(a);
  b := lower(regexp_replace(_mine, '[^[:alnum:][:space:]]', ' ', 'g'));
  b := regexp_replace(b, '\s+', ' ', 'g');
  b := btrim(b);
  IF a = '' OR b = '' THEN RETURN false; END IF;
  IF a = b THEN RETURN true; END IF;
  at := string_to_array(a, ' ');
  bt := string_to_array(b, ' ');
  IF array_length(at, 1) <= array_length(bt, 1) THEN
    short_t := at; long_t := bt;
  ELSE
    short_t := bt; long_t := at;
  END IF;
  FOREACH tok IN ARRAY short_t LOOP
    IF NOT (tok = ANY (long_t)) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;

-- Replace exact-match TL policies with fuzzy match
DROP POLICY IF EXISTS "Team leaders view their cs_tickets" ON public.cs_tickets;
DROP POLICY IF EXISTS "Team leaders update their cs_tickets" ON public.cs_tickets;

CREATE POLICY "Team leaders view their cs_tickets"
ON public.cs_tickets
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'team_leader'::app_role)
  AND public.team_leader_name_matches(team_leader, get_current_user_mentor_name())
);

CREATE POLICY "Team leaders update their cs_tickets"
ON public.cs_tickets
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'team_leader'::app_role)
  AND public.team_leader_name_matches(team_leader, get_current_user_mentor_name())
)
WITH CHECK (
  has_role(auth.uid(), 'team_leader'::app_role)
  AND public.team_leader_name_matches(team_leader, get_current_user_mentor_name())
);