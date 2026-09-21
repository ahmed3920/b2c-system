-- Indexes to make the joins on tutor_external_id fast
CREATE INDEX IF NOT EXISTS idx_tutor_published_modules_ext ON public.tutor_published_modules (tutor_external_id);
CREATE INDEX IF NOT EXISTS idx_tutor_leaves_ext ON public.tutor_leaves (tutor_external_id);
CREATE INDEX IF NOT EXISTS idx_tutor_weekly_occupation_ext ON public.tutor_weekly_occupation (tutor_external_id);
CREATE INDEX IF NOT EXISTS idx_cs_tickets_ext ON public.cs_tickets (tutor_external_id);
CREATE INDEX IF NOT EXISTS idx_engagement_uploads_ext ON public.engagement_uploads (tutor_external_id);
CREATE INDEX IF NOT EXISTS idx_live_session_issues_from ON public.live_session_issues (from_tutor_id);
CREATE INDEX IF NOT EXISTS idx_live_session_issues_to ON public.live_session_issues (to_tutor_id);
CREATE INDEX IF NOT EXISTS idx_weekly_study_plans_ext ON public.weekly_study_plans (tutor_external_id);
CREATE INDEX IF NOT EXISTS idx_session_incidents_ext ON public.session_incidents (tutor_external_id);

CREATE OR REPLACE FUNCTION public.backfill_tutor_assignments_from_overrides()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
AS $function$
DECLARE counts jsonb := '{}'::jsonb; c bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can run the tutor backfill';
  END IF;

  WITH u AS (UPDATE public.session_incidents t SET tutor_name=COALESCE(o.name,t.tutor_name),assigned_mentor_name=COALESCE(o.mentor,t.assigned_mentor_name),team_leader=COALESCE(o.team_leader,t.team_leader),updated_at=now() FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND (t.tutor_name,t.assigned_mentor_name,t.team_leader) IS DISTINCT FROM (COALESCE(o.name,t.tutor_name),COALESCE(o.mentor,t.assigned_mentor_name),COALESCE(o.team_leader,t.team_leader)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('session_incidents',c);

  WITH u AS (UPDATE public.cs_tickets t SET tutor_name=COALESCE(o.name,t.tutor_name),assigned_mentor_name=COALESCE(o.mentor,t.assigned_mentor_name),team_leader=COALESCE(o.team_leader,t.team_leader),updated_at=now() FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND (t.tutor_name,t.assigned_mentor_name,t.team_leader) IS DISTINCT FROM (COALESCE(o.name,t.tutor_name),COALESCE(o.mentor,t.assigned_mentor_name),COALESCE(o.team_leader,t.team_leader)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('cs_tickets',c);

  WITH u AS (UPDATE public.action_plans t SET tutor_name=COALESCE(o.name,t.tutor_name),team_leader=COALESCE(o.team_leader,t.team_leader),updated_at=now() FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND (t.tutor_name,t.team_leader) IS DISTINCT FROM (COALESCE(o.name,t.tutor_name),COALESCE(o.team_leader,t.team_leader)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('action_plans',c);

  WITH u AS (UPDATE public.action_plan_tutors t SET tutor_name=COALESCE(o.name,t.tutor_name),team_leader=COALESCE(o.team_leader,t.team_leader),mentor_name=COALESCE(o.mentor,t.mentor_name) FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND (t.tutor_name,t.team_leader,t.mentor_name) IS DISTINCT FROM (COALESCE(o.name,t.tutor_name),COALESCE(o.team_leader,t.team_leader),COALESCE(o.mentor,t.mentor_name)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('action_plan_tutors',c);

  WITH u AS (UPDATE public.tutor_status t SET tutor_name=COALESCE(o.name,t.tutor_name),team_leader=COALESCE(o.team_leader,t.team_leader),updated_at=now() FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND (t.tutor_name,t.team_leader) IS DISTINCT FROM (COALESCE(o.name,t.tutor_name),COALESCE(o.team_leader,t.team_leader)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('tutor_status',c);

  WITH u AS (UPDATE public.tutor_emails t SET tutor_name=COALESCE(o.name,t.tutor_name),team_leader=COALESCE(o.team_leader,t.team_leader),updated_at=now() FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND (t.tutor_name,t.team_leader) IS DISTINCT FROM (COALESCE(o.name,t.tutor_name),COALESCE(o.team_leader,t.team_leader)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('tutor_emails',c);

  WITH u AS (UPDATE public.tutor_leaves t SET tutor_name=COALESCE(o.name,t.tutor_name),team_leader=COALESCE(o.team_leader,t.team_leader),updated_at=now() FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND (t.tutor_name,t.team_leader) IS DISTINCT FROM (COALESCE(o.name,t.tutor_name),COALESCE(o.team_leader,t.team_leader)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('tutor_leaves',c);

  WITH u AS (UPDATE public.tutor_blocked_modules t SET team_leader=COALESCE(o.team_leader,t.team_leader),updated_at=now() FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND t.team_leader IS DISTINCT FROM COALESCE(o.team_leader,t.team_leader) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('tutor_blocked_modules',c);

  WITH u AS (UPDATE public.tutor_published_modules t SET tutor_name=COALESCE(o.name,t.tutor_name),team_leader=COALESCE(o.team_leader,t.team_leader),updated_at=now() FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND (t.tutor_name,t.team_leader) IS DISTINCT FROM (COALESCE(o.name,t.tutor_name),COALESCE(o.team_leader,t.team_leader)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('tutor_published_modules',c);

  WITH u AS (UPDATE public.tutor_weekend_days t SET tutor_name=COALESCE(o.name,t.tutor_name),team_leader=COALESCE(o.team_leader,t.team_leader),updated_at=now() FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND (t.tutor_name,t.team_leader) IS DISTINCT FROM (COALESCE(o.name,t.tutor_name),COALESCE(o.team_leader,t.team_leader)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('tutor_weekend_days',c);

  WITH u AS (UPDATE public.tutor_weekly_occupation t SET tutor_name=COALESCE(o.name,t.tutor_name),team_leader=COALESCE(o.team_leader,t.team_leader),updated_at=now() FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND (t.tutor_name,t.team_leader) IS DISTINCT FROM (COALESCE(o.name,t.tutor_name),COALESCE(o.team_leader,t.team_leader)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('tutor_weekly_occupation',c);

  WITH u AS (UPDATE public.weekly_study_plans t SET tutor_name=COALESCE(o.name,t.tutor_name),team_leader=COALESCE(o.team_leader,t.team_leader),updated_at=now() FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND (t.tutor_name,t.team_leader) IS DISTINCT FROM (COALESCE(o.name,t.tutor_name),COALESCE(o.team_leader,t.team_leader)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('weekly_study_plans',c);

  WITH u AS (UPDATE public.engagement_uploads t SET tutor_name=COALESCE(o.name,t.tutor_name),team_leader=COALESCE(o.team_leader,t.team_leader) FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND (t.tutor_name,t.team_leader) IS DISTINCT FROM (COALESCE(o.name,t.tutor_name),COALESCE(o.team_leader,t.team_leader)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('engagement_uploads',c);

  WITH u AS (UPDATE public.email_logs t SET tutor_name=COALESCE(o.name,t.tutor_name) FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND t.tutor_name IS DISTINCT FROM COALESCE(o.name,t.tutor_name) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('email_logs',c);

  WITH u AS (UPDATE public.session_incident_tokens t SET tutor_name=COALESCE(o.name,t.tutor_name),team_leader=COALESCE(o.team_leader,t.team_leader) FROM public.tutor_roster_overrides o WHERE t.tutor_external_id=o.tutor_external_id AND (t.tutor_name,t.team_leader) IS DISTINCT FROM (COALESCE(o.name,t.tutor_name),COALESCE(o.team_leader,t.team_leader)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('session_incident_tokens',c);

  WITH u AS (UPDATE public.live_session_issues t SET from_tutor_name=COALESCE(o.name,t.from_tutor_name),team_leader=COALESCE(o.team_leader,t.team_leader),updated_at=now() FROM public.tutor_roster_overrides o WHERE t.from_tutor_id=o.tutor_external_id AND (t.from_tutor_name,t.team_leader) IS DISTINCT FROM (COALESCE(o.name,t.from_tutor_name),COALESCE(o.team_leader,t.team_leader)) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('live_session_issues_from',c);

  WITH u AS (UPDATE public.live_session_issues t SET to_tutor_name=COALESCE(o.name,t.to_tutor_name),updated_at=now() FROM public.tutor_roster_overrides o WHERE t.to_tutor_id=o.tutor_external_id AND t.to_tutor_name IS DISTINCT FROM COALESCE(o.name,t.to_tutor_name) RETURNING 1) SELECT count(*) INTO c FROM u; counts:=counts||jsonb_build_object('live_session_issues_to',c);

  RETURN jsonb_build_object('ok',true,'updated',counts,'ran_at',now());
END $function$;