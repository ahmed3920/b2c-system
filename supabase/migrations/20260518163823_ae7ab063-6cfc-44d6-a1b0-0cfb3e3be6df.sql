
-- 1) Improve team_leader_name_matches to handle hyphenated/concatenated variants
-- e.g. "Mariam Ahmed El-Sheikh" should match "Mariam Ahmed Elsheikh"
CREATE OR REPLACE FUNCTION public.team_leader_name_matches(_candidate text, _mine text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  a text; b text;
  a_compact text; b_compact text;
  at text[]; bt text[];
  short_t text[]; long_t text[];
  long_compact text;
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

  -- Compact comparison: ignore spaces entirely (handles "El-Sheikh" vs "Elsheikh")
  a_compact := replace(a, ' ', '');
  b_compact := replace(b, ' ', '');
  IF a_compact = b_compact THEN RETURN true; END IF;

  at := string_to_array(a, ' ');
  bt := string_to_array(b, ' ');
  IF array_length(at, 1) <= array_length(bt, 1) THEN
    short_t := at; long_t := bt; long_compact := b_compact;
  ELSE
    short_t := bt; long_t := at; long_compact := a_compact;
  END IF;
  FOREACH tok IN ARRAY short_t LOOP
    IF NOT (tok = ANY (long_t)) AND position(tok in long_compact) = 0 THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$function$;

-- 2) Sync session_incidents & cs_tickets when tutor_roster_overrides change
CREATE OR REPLACE FUNCTION public.sync_tutor_assignments_from_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.mentor IS NOT NULL OR NEW.team_leader IS NOT NULL THEN
    UPDATE public.session_incidents
       SET assigned_mentor_name = COALESCE(NEW.mentor, assigned_mentor_name),
           team_leader          = COALESCE(NEW.team_leader, team_leader),
           updated_at           = now()
     WHERE tutor_external_id = NEW.tutor_external_id;

    UPDATE public.cs_tickets
       SET assigned_mentor_name = COALESCE(NEW.mentor, assigned_mentor_name),
           team_leader          = COALESCE(NEW.team_leader, team_leader),
           updated_at           = now()
     WHERE tutor_external_id = NEW.tutor_external_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tutor_assignments ON public.tutor_roster_overrides;
CREATE TRIGGER trg_sync_tutor_assignments
AFTER INSERT OR UPDATE ON public.tutor_roster_overrides
FOR EACH ROW EXECUTE FUNCTION public.sync_tutor_assignments_from_override();

-- 3) Backfill existing rows so current overrides propagate now
UPDATE public.session_incidents si
   SET assigned_mentor_name = COALESCE(o.mentor, si.assigned_mentor_name),
       team_leader          = COALESCE(o.team_leader, si.team_leader),
       updated_at           = now()
  FROM public.tutor_roster_overrides o
 WHERE o.tutor_external_id = si.tutor_external_id
   AND (
     (o.mentor IS NOT NULL AND COALESCE(si.assigned_mentor_name,'') <> o.mentor)
     OR
     (o.team_leader IS NOT NULL AND COALESCE(si.team_leader,'') <> o.team_leader)
   );

UPDATE public.cs_tickets ct
   SET assigned_mentor_name = COALESCE(o.mentor, ct.assigned_mentor_name),
       team_leader          = COALESCE(o.team_leader, ct.team_leader),
       updated_at           = now()
  FROM public.tutor_roster_overrides o
 WHERE o.tutor_external_id = ct.tutor_external_id
   AND (
     (o.mentor IS NOT NULL AND COALESCE(ct.assigned_mentor_name,'') <> o.mentor)
     OR
     (o.team_leader IS NOT NULL AND COALESCE(ct.team_leader,'') <> o.team_leader)
   );
