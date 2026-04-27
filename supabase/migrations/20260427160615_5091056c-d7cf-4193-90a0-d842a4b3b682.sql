-- Enums
CREATE TYPE public.vision_plan_status AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE public.vision_plan_urgency AS ENUM ('critical', 'high', 'medium', 'low');

-- Tags table
CREATE TABLE public.vision_board_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#056eec',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vision_board_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage vision_board_tags"
ON public.vision_board_tags
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_vision_board_tags_updated_at
BEFORE UPDATE ON public.vision_board_tags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Plans table
CREATE TABLE public.vision_board_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status vision_plan_status NOT NULL DEFAULT 'not_started',
  urgency vision_plan_urgency NOT NULL DEFAULT 'medium',
  owner_user_id UUID,
  owner_name TEXT,
  deadline DATE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vision_board_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage vision_board_plans"
ON public.vision_board_plans
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_vision_board_plans_updated_at
BEFORE UPDATE ON public.vision_board_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vision_plans_urgency ON public.vision_board_plans(urgency);
CREATE INDEX idx_vision_plans_status ON public.vision_board_plans(status);

-- Realtime
ALTER TABLE public.vision_board_plans REPLICA IDENTITY FULL;
ALTER TABLE public.vision_board_tags REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vision_board_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vision_board_tags;

-- Seed default tags
INSERT INTO public.vision_board_tags (name, color, display_order) VALUES
  ('Marketing', '#fe7f1b', 1),
  ('Product', '#056eec', 2),
  ('Operations', '#10b981', 3),
  ('Sales', '#8b5cf6', 4),
  ('Strategy', '#ef4444', 5),
  ('Tech', '#0ea5e9', 6);