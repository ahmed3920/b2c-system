
-- Enum for who created the training entry
DO $$ BEGIN
  CREATE TYPE public.training_creator_type AS ENUM ('team_leader', 'mentor', 'tutor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_leader text NOT NULL,
  creator_type public.training_creator_type NOT NULL,
  creator_name text NOT NULL,
  creator_external_id text,
  conducted_by jsonb NOT NULL DEFAULT '[]'::jsonb,
  training_date date NOT NULL,
  training_time time without time zone NOT NULL,
  title text NOT NULL,
  notes text,
  sub_teams text[] NOT NULL DEFAULT '{}'::text[],
  material_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  record_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainings_team_leader ON public.trainings (team_leader);
CREATE INDEX IF NOT EXISTS idx_trainings_date ON public.trainings (training_date DESC);

ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins manage all trainings"
  ON public.trainings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Team leaders / super team leaders manage their team's trainings
CREATE POLICY "Team leaders manage their trainings"
  ON public.trainings FOR ALL
  TO authenticated
  USING (
    (public.has_role(auth.uid(), 'team_leader'::app_role)
      OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
    AND public.team_leader_name_matches(team_leader, public.get_current_user_mentor_name())
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'team_leader'::app_role)
      OR public.has_role(auth.uid(), 'super_team_leader'::app_role))
    AND public.team_leader_name_matches(team_leader, public.get_current_user_mentor_name())
  );

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_trainings_updated_at ON public.trainings;
CREATE TRIGGER trg_trainings_updated_at
  BEFORE UPDATE ON public.trainings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for training materials (public-read for shareable links)
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-materials', 'training-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Public read of training-materials
DROP POLICY IF EXISTS "Public read training-materials" ON storage.objects;
CREATE POLICY "Public read training-materials"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'training-materials');

-- Admins + team leaders can upload/update/delete in this bucket
DROP POLICY IF EXISTS "TL/Admin upload training-materials" ON storage.objects;
CREATE POLICY "TL/Admin upload training-materials"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'training-materials'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'team_leader'::app_role)
      OR public.has_role(auth.uid(), 'super_team_leader'::app_role)
    )
  );

DROP POLICY IF EXISTS "TL/Admin update training-materials" ON storage.objects;
CREATE POLICY "TL/Admin update training-materials"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'training-materials'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'team_leader'::app_role)
      OR public.has_role(auth.uid(), 'super_team_leader'::app_role)
    )
  );

DROP POLICY IF EXISTS "TL/Admin delete training-materials" ON storage.objects;
CREATE POLICY "TL/Admin delete training-materials"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'training-materials'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'team_leader'::app_role)
      OR public.has_role(auth.uid(), 'super_team_leader'::app_role)
    )
  );
