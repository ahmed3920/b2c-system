CREATE OR REPLACE FUNCTION public.notify_cs_ticket_validated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recipient uuid;
  notified uuid[] := ARRAY[]::uuid[];
  msg text;
BEGIN
  IF COALESCE(OLD.status,'') = 'Pending'
     AND COALESCE(NEW.status,'') <> 'Pending'
     AND COALESCE(NEW.team_leader_response,'') <> '' THEN

    msg := 'CS ticket #' || NEW.ticket_number || ' (' || COALESCE(NEW.tutor_name,'tutor') || ') was updated to ' || NEW.status;

    FOR recipient IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
      UNION
      SELECT user_id FROM public.cs_ticket_full_access
      UNION
      SELECT NEW.assigned_mentor_id WHERE NEW.assigned_mentor_id IS NOT NULL
    LOOP
      IF recipient IS NOT NULL AND NOT (recipient = ANY (notified)) THEN
        INSERT INTO public.notifications (user_id, type, message, link)
        VALUES (recipient, 'cs_ticket_validated', msg, '/performance');
        notified := notified || recipient;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_cs_ticket_validated ON public.cs_tickets;
CREATE TRIGGER trg_notify_cs_ticket_validated
AFTER UPDATE ON public.cs_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_cs_ticket_validated();

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;