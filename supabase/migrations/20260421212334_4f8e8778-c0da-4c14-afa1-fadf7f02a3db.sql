CREATE OR REPLACE FUNCTION public.get_my_team_cs_tickets()
RETURNS SETOF public.cs_tickets
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.cs_tickets
  WHERE public.team_leader_name_matches(
    team_leader,
    public.get_current_user_mentor_name()
  )
  ORDER BY created_at DESC
$$;