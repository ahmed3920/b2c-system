CREATE TABLE public.project_upload_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date date NOT NULL UNIQUE,
  zero_students integer NOT NULL DEFAULT 0,
  total_students integer NOT NULL DEFAULT 0,
  by_grade jsonb NOT NULL DEFAULT '[]'::jsonb,
  by_team_leader jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.project_upload_snapshots TO authenticated;
GRANT ALL ON public.project_upload_snapshots TO service_role;

ALTER TABLE public.project_upload_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view project upload snapshots"
ON public.project_upload_snapshots
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team_leader')
  OR public.has_role(auth.uid(), 'super_team_leader')
);

CREATE TRIGGER update_project_upload_snapshots_updated_at
BEFORE UPDATE ON public.project_upload_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.project_upload_snapshots (snapshot_date, zero_students, total_students)
VALUES ('2026-09-09', 1820, 0)
ON CONFLICT (snapshot_date) DO NOTHING;