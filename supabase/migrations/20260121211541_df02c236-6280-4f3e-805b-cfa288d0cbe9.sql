-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'team_leader', 'mentor');

-- Create user_roles table (CRITICAL: roles must be in separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'mentor',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Update profiles table to support all user types
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS active_status BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

-- Update profiles RLS to allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Team leaders can view their team members' profiles
CREATE POLICY "Team leaders can view team profiles"
ON public.profiles FOR SELECT
USING (
  public.has_role(auth.uid(), 'team_leader') 
  AND team_leader = (SELECT mentor_name FROM public.profiles WHERE user_id = auth.uid())
);

-- Update tasks table for role-based access
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS assigned_by UUID;

-- Admins can view all tasks
CREATE POLICY "Admins can view all tasks"
ON public.tasks FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Team leaders can view their team's tasks
CREATE POLICY "Team leaders can view team tasks"
ON public.tasks FOR SELECT
USING (
  public.has_role(auth.uid(), 'team_leader')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = public.tasks.user_id
    AND p.team_leader = (SELECT mentor_name FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Admins can insert tasks for anyone
CREATE POLICY "Admins can insert any tasks"
ON public.tasks FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Team leaders can insert tasks for their team
CREATE POLICY "Team leaders can insert team tasks"
ON public.tasks FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'team_leader')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = public.tasks.user_id
    AND p.team_leader = (SELECT mentor_name FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Admins can update any tasks
CREATE POLICY "Admins can update any tasks"
ON public.tasks FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Team leaders can update their team's tasks
CREATE POLICY "Team leaders can update team tasks"
ON public.tasks FOR UPDATE
USING (
  public.has_role(auth.uid(), 'team_leader')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = public.tasks.user_id
    AND p.team_leader = (SELECT mentor_name FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  related_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  read_status BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Create achievements table
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  achievement_type TEXT NOT NULL,
  achievement_value INTEGER DEFAULT 0,
  date_earned TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_type)
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own achievements"
ON public.achievements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert achievements"
ON public.achievements FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create goals table
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_type TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  deadline DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own goals"
ON public.goals FOR ALL
USING (auth.uid() = user_id);

-- Function to auto-assign mentor role on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'mentor')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_assign_role
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_role();