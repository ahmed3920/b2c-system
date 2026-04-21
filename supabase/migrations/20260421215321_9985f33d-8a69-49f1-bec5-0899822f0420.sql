-- RPC to broadcast an announcement notification to matching users by audience.
-- Audience values: 'team_leaders', 'mentors', 'both'
CREATE OR REPLACE FUNCTION public.broadcast_announcement_notification(
  _title text,
  _audience text,
  _priority text DEFAULT 'normal'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  inserted_count integer := 0;
  msg text;
BEGIN
  -- Only admins may broadcast
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can broadcast announcements';
  END IF;

  msg := CASE WHEN _priority = 'important' THEN '📢 Important: ' ELSE '📢 ' END
         || _title;

  FOR recipient_id IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE
      CASE
        WHEN _audience = 'team_leaders' THEN ur.role IN ('team_leader', 'super_team_leader')
        WHEN _audience = 'mentors'      THEN ur.role IN ('mentor', 'community_moderator')
        WHEN _audience = 'both'         THEN ur.role IN ('team_leader', 'super_team_leader', 'mentor', 'community_moderator')
        ELSE false
      END
  LOOP
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (recipient_id, 'announcement_new', msg, '/home');
    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN inserted_count;
END;
$$;