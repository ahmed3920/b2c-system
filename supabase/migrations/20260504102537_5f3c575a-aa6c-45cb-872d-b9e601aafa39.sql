
-- ============ ENUMS ============
CREATE TYPE public.system_kind AS ENUM ('b2c', 'cms');
CREATE TYPE public.cms_app_role AS ENUM ('cms_admin', 'cms_supervisor', 'cms_member');
CREATE TYPE public.cms_task_status AS ENUM ('todo', 'in_progress', 'done', 'archived');
CREATE TYPE public.cms_task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.cms_attendance_status AS ENUM ('on_time', 'late', 'absent');

-- ============ user_systems ============
CREATE TABLE public.user_systems (
  user_id uuid PRIMARY KEY,
  system public.system_kind NOT NULL DEFAULT 'b2c',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_systems ENABLE ROW LEVEL SECURITY;

-- Backfill existing users as b2c
INSERT INTO public.user_systems (user_id, system)
SELECT user_id, 'b2c'::public.system_kind FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_user_system(_user_id uuid)
RETURNS public.system_kind LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT system FROM public.user_systems WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_cms_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_systems WHERE user_id = _user_id AND system = 'cms')
$$;

CREATE POLICY "Users see their own system tag" ON public.user_systems
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage all system tags" ON public.user_systems
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ cms_profiles ============
CREATE TABLE public.cms_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text,
  active_status boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cms_profiles ENABLE ROW LEVEL SECURITY;

-- ============ cms_user_roles ============
CREATE TABLE public.cms_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.cms_app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.cms_user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_cms_role(_user_id uuid, _role public.cms_app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.cms_user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_cms_role(_user_id uuid)
RETURNS public.cms_app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.cms_user_roles WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'cms_admin' THEN 1
    WHEN 'cms_supervisor' THEN 2
    WHEN 'cms_member' THEN 3
  END LIMIT 1
$$;

CREATE POLICY "CMS users see their own role" ON public.cms_user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "CMS admins view all roles" ON public.cms_user_roles
  FOR SELECT TO authenticated USING (public.has_cms_role(auth.uid(), 'cms_admin'));
CREATE POLICY "CMS admins manage roles" ON public.cms_user_roles
  FOR ALL TO authenticated
  USING (public.has_cms_role(auth.uid(), 'cms_admin'))
  WITH CHECK (public.has_cms_role(auth.uid(), 'cms_admin'));

-- ============ cms_profiles RLS ============
CREATE POLICY "CMS users view own profile" ON public.cms_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "CMS admins view all profiles" ON public.cms_profiles
  FOR SELECT TO authenticated USING (public.has_cms_role(auth.uid(), 'cms_admin'));
CREATE POLICY "CMS supervisors view all profiles" ON public.cms_profiles
  FOR SELECT TO authenticated USING (public.has_cms_role(auth.uid(), 'cms_supervisor'));
CREATE POLICY "CMS admins manage profiles" ON public.cms_profiles
  FOR ALL TO authenticated
  USING (public.has_cms_role(auth.uid(), 'cms_admin'))
  WITH CHECK (public.has_cms_role(auth.uid(), 'cms_admin'));
CREATE POLICY "CMS users update their own profile" ON public.cms_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "CMS users insert own profile" ON public.cms_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Protect identity fields on self-update
CREATE OR REPLACE FUNCTION public.protect_cms_profile_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_cms_role(auth.uid(), 'cms_admin') THEN RETURN NEW; END IF;
  IF auth.uid() = OLD.user_id THEN
    IF NEW.full_name IS DISTINCT FROM OLD.full_name
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.active_status IS DISTINCT FROM OLD.active_status
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'You cannot change identity fields on your own CMS profile';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_cms_profile_self_update_trg
  BEFORE UPDATE ON public.cms_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_cms_profile_self_update();

CREATE TRIGGER cms_profiles_updated_at
  BEFORE UPDATE ON public.cms_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ cms_tasks ============
CREATE TABLE public.cms_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status public.cms_task_status NOT NULL DEFAULT 'todo',
  priority public.cms_task_priority NOT NULL DEFAULT 'medium',
  date_from date,
  date_to date,
  assignee_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cms_tasks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER cms_tasks_updated_at
  BEFORE UPDATE ON public.cms_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "CMS admins manage all tasks" ON public.cms_tasks
  FOR ALL TO authenticated
  USING (public.has_cms_role(auth.uid(), 'cms_admin'))
  WITH CHECK (public.has_cms_role(auth.uid(), 'cms_admin'));
CREATE POLICY "CMS supervisors view all tasks" ON public.cms_tasks
  FOR SELECT TO authenticated USING (public.has_cms_role(auth.uid(), 'cms_supervisor'));
CREATE POLICY "CMS supervisors create tasks" ON public.cms_tasks
  FOR INSERT TO authenticated WITH CHECK (public.has_cms_role(auth.uid(), 'cms_supervisor') AND created_by = auth.uid());
CREATE POLICY "CMS supervisors update all tasks" ON public.cms_tasks
  FOR UPDATE TO authenticated
  USING (public.has_cms_role(auth.uid(), 'cms_supervisor'))
  WITH CHECK (public.has_cms_role(auth.uid(), 'cms_supervisor'));
CREATE POLICY "CMS members view own tasks" ON public.cms_tasks
  FOR SELECT TO authenticated USING (assignee_id = auth.uid() OR created_by = auth.uid());
CREATE POLICY "CMS members update own tasks" ON public.cms_tasks
  FOR UPDATE TO authenticated USING (assignee_id = auth.uid()) WITH CHECK (assignee_id = auth.uid());

-- ============ cms_attendance ============
CREATE TABLE public.cms_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text,
  date date NOT NULL,
  check_in_time timestamptz,
  status public.cms_attendance_status NOT NULL DEFAULT 'absent',
  minutes_late integer NOT NULL DEFAULT 0,
  late_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
ALTER TABLE public.cms_attendance ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER cms_attendance_updated_at
  BEFORE UPDATE ON public.cms_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "CMS admins manage all attendance" ON public.cms_attendance
  FOR ALL TO authenticated
  USING (public.has_cms_role(auth.uid(), 'cms_admin'))
  WITH CHECK (public.has_cms_role(auth.uid(), 'cms_admin'));
CREATE POLICY "CMS supervisors view all attendance" ON public.cms_attendance
  FOR SELECT TO authenticated USING (public.has_cms_role(auth.uid(), 'cms_supervisor'));
CREATE POLICY "CMS users view own attendance" ON public.cms_attendance
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "CMS users insert own attendance" ON public.cms_attendance
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_cms_user(auth.uid()));
CREATE POLICY "CMS users update own attendance reason" ON public.cms_attendance
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
