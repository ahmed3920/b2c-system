CREATE OR REPLACE FUNCTION public.cs_ticket_belongs_to_me(_team_leader text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.team_leader_name_matches(
    _team_leader,
    public.get_current_user_mentor_name()
  )
$$;