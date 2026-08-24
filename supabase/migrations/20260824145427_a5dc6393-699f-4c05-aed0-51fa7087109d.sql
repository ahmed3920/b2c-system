CREATE OR REPLACE FUNCTION public.notify_cs_ticket_mentor_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_mentor_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_mentor_id IS DISTINCT FROM OLD.assigned_mentor_id) THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (
      NEW.assigned_mentor_id,
      'cs_ticket_assigned',
      'You have been assigned CS ticket #' || NEW.ticket_number || ' for ' || NEW.tutor_name,
      '/performance?tab=cs-tickets&ticket=' || NEW.ticket_number
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_cs_ticket_validated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient uuid;
  notified uuid[] := ARRAY[]::uuid[];
  msg text;
  lnk text;
BEGIN
  IF COALESCE(OLD.status::text,'') = 'Pending'
     AND COALESCE(NEW.status::text,'') <> 'Pending'
     AND COALESCE(NEW.team_leader_response,'') <> '' THEN

    msg := 'CS ticket #' || NEW.ticket_number || ' (' || COALESCE(NEW.tutor_name,'tutor') || ') was updated to ' || NEW.status::text;
    lnk := '/performance?tab=cs-tickets&ticket=' || NEW.ticket_number;

    FOR recipient IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
      UNION
      SELECT user_id FROM public.cs_ticket_full_access
      UNION
      SELECT NEW.assigned_mentor_id WHERE NEW.assigned_mentor_id IS NOT NULL
    LOOP
      IF recipient IS NOT NULL AND NOT (recipient = ANY (notified)) THEN
        INSERT INTO public.notifications (user_id, type, message, link)
        VALUES (recipient, 'cs_ticket_validated', msg, lnk);
        notified := notified || recipient;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_cs_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tl_user_id uuid; extra_tl text;
  extra_mentor_id uuid; extra_mentor_name text;
  notified uuid[] := ARRAY[]::uuid[];
  lnk text := '/performance?tab=cs-tickets&ticket=' || NEW.ticket_number;
BEGIN
  FOR tl_user_id IN SELECT public.find_team_leader_user_ids(NEW.team_leader) LOOP
    IF NOT (tl_user_id = ANY (notified)) THEN
      INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (tl_user_id, 'cs_ticket_new',
        'New CS ticket #' || NEW.ticket_number || ' for ' || NEW.tutor_name || ' needs validation',
        lnk);
      notified := notified || tl_user_id;
    END IF;
  END LOOP;
  IF jsonb_typeof(NEW.additional_tutors) = 'array' THEN
    FOR extra_tl IN
      SELECT DISTINCT elem->>'team_leader' FROM jsonb_array_elements(NEW.additional_tutors) AS elem
      WHERE elem->>'team_leader' IS NOT NULL
    LOOP
      FOR tl_user_id IN SELECT public.find_team_leader_user_ids(extra_tl) LOOP
        IF NOT (tl_user_id = ANY (notified)) THEN
          INSERT INTO public.notifications (user_id, type, message, link)
          VALUES (tl_user_id, 'cs_ticket_new',
            'New CS ticket #' || NEW.ticket_number || ' (multi-tutor) needs validation',
            lnk);
          notified := notified || tl_user_id;
        END IF;
      END LOOP;
    END LOOP;
    FOR extra_mentor_id, extra_mentor_name IN
      SELECT DISTINCT (elem->>'assigned_mentor_id')::uuid, elem->>'tutor_name'
      FROM jsonb_array_elements(NEW.additional_tutors) AS elem
      WHERE elem->>'assigned_mentor_id' IS NOT NULL AND elem->>'assigned_mentor_id' <> ''
    LOOP
      IF NOT (extra_mentor_id = ANY (notified)) THEN
        INSERT INTO public.notifications (user_id, type, message, link)
        VALUES (extra_mentor_id, 'cs_ticket_assigned',
          'You have been assigned CS ticket #' || NEW.ticket_number || ' for ' || COALESCE(extra_mentor_name,'a tutor'),
          lnk);
        notified := notified || extra_mentor_id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;