-- Fix infinite recursion in profiles RLS policies by using security definer function

-- First, create a helper function to get current user's mentor_name without recursion
CREATE OR REPLACE FUNCTION public.get_current_user_mentor_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mentor_name
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Drop the problematic policies
DROP POLICY IF EXISTS "Team leaders can view team profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate policies without recursion
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team leaders can view team profiles"
ON public.profiles FOR SELECT
USING (
  public.has_role(auth.uid(), 'team_leader') 
  AND team_leader = public.get_current_user_mentor_name()
);

-- Also fix the tasks policies that reference profiles
DROP POLICY IF EXISTS "Team leaders can view team tasks" ON public.tasks;
DROP POLICY IF EXISTS "Team leaders can insert team tasks" ON public.tasks;
DROP POLICY IF EXISTS "Team leaders can update team tasks" ON public.tasks;

-- Create a helper function for team task access
CREATE OR REPLACE FUNCTION public.is_user_in_my_team(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = _user_id
      AND p.team_leader = (
        SELECT mentor_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
      )
  )
$$;

CREATE POLICY "Team leaders can view team tasks"
ON public.tasks FOR SELECT
USING (
  public.has_role(auth.uid(), 'team_leader') 
  AND public.is_user_in_my_team(user_id)
);

CREATE POLICY "Team leaders can insert team tasks"
ON public.tasks FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'team_leader') 
  AND public.is_user_in_my_team(user_id)
);

CREATE POLICY "Team leaders can update team tasks"
ON public.tasks FOR UPDATE
USING (
  public.has_role(auth.uid(), 'team_leader') 
  AND public.is_user_in_my_team(user_id)
);