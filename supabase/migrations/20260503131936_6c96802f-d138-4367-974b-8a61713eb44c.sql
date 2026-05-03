
-- ============ tutor_emails ============
DROP POLICY IF EXISTS "Authenticated view tutor_emails" ON public.tutor_emails;
CREATE POLICY "Admins view all tutor_emails"
ON public.tutor_emails FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team leaders view their team tutor_emails"
ON public.tutor_emails FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(), 'team_leader'::app_role) OR has_role(auth.uid(), 'super_team_leader'::app_role))
  AND (team_leader IS NULL OR team_leader_name_matches(team_leader, get_current_user_mentor_name()))
);

-- ============ team_leader_emails ============
DROP POLICY IF EXISTS "Authenticated view team_leader_emails" ON public.team_leader_emails;
CREATE POLICY "Admins view all team_leader_emails"
ON public.team_leader_emails FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ profiles: prevent self-escalation via mentor_name change ============
CREATE OR REPLACE FUNCTION public.protect_profile_self_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() = OLD.user_id THEN
    IF NEW.mentor_name IS DISTINCT FROM OLD.mentor_name
       OR NEW.mentor_id IS DISTINCT FROM OLD.mentor_id
       OR NEW.team_leader IS DISTINCT FROM OLD.team_leader
       OR NEW.active_status IS DISTINCT FROM OLD.active_status
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'You cannot change identity fields on your own profile';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_profile_self_update_trg ON public.profiles;
CREATE TRIGGER protect_profile_self_update_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_self_update();

-- ============ cs-recordings: tighten path check ============
DROP POLICY IF EXISTS cs_recordings_mentor_read ON storage.objects;
CREATE POLICY cs_recordings_mentor_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cs-recordings'
  AND EXISTS (
    SELECT 1 FROM public.cs_tickets t
    WHERE t.assigned_mentor_id = auth.uid()
      AND objects.name LIKE (t.id::text || '/%')
  )
);

-- ============ login_tokens: add expiry & single-use ============
ALTER TABLE public.login_tokens
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS used_at timestamptz;
UPDATE public.login_tokens SET expires_at = now() + interval '30 days' WHERE expires_at < now();
