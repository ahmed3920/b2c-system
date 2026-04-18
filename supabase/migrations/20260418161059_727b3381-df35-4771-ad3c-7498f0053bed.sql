
-- Enums
CREATE TYPE public.action_plan_category AS ENUM ('quality', 'leaves_abuse', 'communication', 'cs_complaints');
CREATE TYPE public.action_plan_status AS ENUM ('active', 'on_hold', 'resolved', 'escalated');
CREATE TYPE public.action_plan_evaluation AS ENUM ('improved', 'not_improved');

-- Tutors directory (sourced from uploaded sheet)
CREATE TABLE public.action_plan_tutors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_external_id text,
  tutor_name text NOT NULL,
  team_leader text NOT NULL,
  mentor_name text,
  is_mentor boolean DEFAULT false,
  language text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_action_plan_tutors_team_leader ON public.action_plan_tutors(team_leader);
CREATE INDEX idx_action_plan_tutors_name ON public.action_plan_tutors(tutor_name);

ALTER TABLE public.action_plan_tutors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tutors directory"
  ON public.action_plan_tutors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team leaders view their tutors"
  ON public.action_plan_tutors FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'team_leader'::app_role) AND team_leader = get_current_user_mentor_name());

-- Action plans (tickets)
CREATE TABLE public.action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_name text NOT NULL,
  tutor_external_id text,
  team_leader text NOT NULL,
  category public.action_plan_category NOT NULL,
  status public.action_plan_status NOT NULL DEFAULT 'active',
  summary text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  evaluation public.action_plan_evaluation,
  evaluation_notes text,
  resolved_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_action_plans_team_leader ON public.action_plans(team_leader);
CREATE INDEX idx_action_plans_status ON public.action_plans(status);
CREATE INDEX idx_action_plans_category ON public.action_plans(category);

ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all action plans"
  ON public.action_plans FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team leaders manage their action plans"
  ON public.action_plans FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_leader'::app_role) AND team_leader = get_current_user_mentor_name())
  WITH CHECK (has_role(auth.uid(), 'team_leader'::app_role) AND team_leader = get_current_user_mentor_name());

CREATE TRIGGER update_action_plans_updated_at
  BEFORE UPDATE ON public.action_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Timeline steps (thread-style updates)
CREATE TABLE public.action_plan_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.action_plans(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text,
  note text NOT NULL,
  status_change public.action_plan_status,
  progress_change integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_action_plan_steps_plan ON public.action_plan_steps(plan_id);

ALTER TABLE public.action_plan_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all steps"
  ON public.action_plan_steps FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team leaders manage steps for their plans"
  ON public.action_plan_steps FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'team_leader'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.action_plans p
      WHERE p.id = action_plan_steps.plan_id
        AND p.team_leader = get_current_user_mentor_name()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'team_leader'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.action_plans p
      WHERE p.id = action_plan_steps.plan_id
        AND p.team_leader = get_current_user_mentor_name()
    )
  );
