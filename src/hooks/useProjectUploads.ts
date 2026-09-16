import { useCallback, useEffect, useState } from "react";
import { runReplicaQuery } from "@/hooks/useReplicaQuery";
import { supabase } from "@/integrations/supabase/client";

export const PROJECTS_BASELINE = { date: "2026-09-09", zero: 1615 };

export type ProjectsSummary = {
  students: number;
  zero_students: number;
  projects: number | null;
  avg_projects: string | number | null;
  not_started_students: number;
};

export type NotStartedRow = {
  s_id: string;
  student_name: string | null;
  grade: string | null;
  tutor_name: string | null;
  tutor_tid: string | null;
  team_leader: string;
};

export type GradeRow = { grade: string; zero_students: number; students: number };
export type TeamLeaderRow = { team_leader: string; zero_students: number; students: number };
export type DistributionRow = { bucket: string; bucket_order: number; students: number };
export type DistributionCompareRow = {
  bucket: string;
  bucket_order: number;
  baseline_students: number;
  current_students: number;
};
export type SessionTypeRow = { session_type: string; students: number; zero_students: number };
export type ZeroStudentRow = {
  s_id: string;
  student_name: string | null;
  grade: string | null;
  tutor_name: string | null;
  tutor_tid: string | null;
  team_leader: string;
  projects_count: number;
  attended_sessions: number;
};
export type SnapshotRow = {
  snapshot_date: string;
  zero_students: number;
  total_students: number;
};
export type UploadsDayRow = { day: string; projects: number; students: number };
export type UploadsDayTypeRow = UploadsDayRow & { session_type: string };

const p = (v: string) => (v && v !== "" ? v : null);

export function useProjectUploads(filters: { teamLeader: string; grade: string; search: string }) {
  const { teamLeader, grade, search } = filters;
  const [summary, setSummary] = useState<ProjectsSummary | null>(null);
  const [byGrade, setByGrade] = useState<GradeRow[]>([]);
  const [byTeamLeader, setByTeamLeader] = useState<TeamLeaderRow[]>([]);
  const [distribution, setDistribution] = useState<DistributionRow[]>([]);
  const [students, setStudents] = useState<ZeroStudentRow[]>([]);
  const [notStarted, setNotStarted] = useState<NotStartedRow[]>([]);
  const [bySessionType, setBySessionType] = useState<SessionTypeRow[]>([]);
  const [options, setOptions] = useState<{ teamLeaders: string[]; grades: string[] }>({
    teamLeaders: [],
    grades: [],
  });
  const [trend, setTrend] = useState<SnapshotRow[]>([]);
  const [uploadsByDay, setUploadsByDay] = useState<UploadsDayRow[]>([]);
  const [uploadsByDayType, setUploadsByDayType] = useState<UploadsDayTypeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { team_lead: p(teamLeader), grade: p(grade), search: p(search) };
      const [sum, grades, tls, dist, sessTypes, list, notStartedList, opts, snaps, uploads, uploadsTyped] = await Promise.all([
        runReplicaQuery<ProjectsSummary>("analytics_projects_summary", params),
        runReplicaQuery<GradeRow>("analytics_projects_by_grade", params),
        runReplicaQuery<TeamLeaderRow>("analytics_projects_by_team_leader", params),
        runReplicaQuery<DistributionRow>("analytics_projects_distribution", params),
        runReplicaQuery<SessionTypeRow>("analytics_projects_by_session_type", params),
        runReplicaQuery<ZeroStudentRow>("analytics_projects_students", {
          ...params,
          limit: 1000,
          offset: 0,
        }),
        runReplicaQuery<NotStartedRow>("analytics_projects_not_started", {
          ...params,
          limit: 1000,
          offset: 0,
        }),
        runReplicaQuery<{ kind: string; value: string }>("analytics_projects_options", {
          team_lead: null,
          grade: null,
          search: null,
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("project_upload_snapshots")
          .select("snapshot_date, zero_students, total_students")
          .order("snapshot_date", { ascending: true }),
        runReplicaQuery<UploadsDayRow>("analytics_projects_uploads_by_day", {
          ...params,
          since: PROJECTS_BASELINE.date,
        }),
        runReplicaQuery<UploadsDayTypeRow>("analytics_projects_uploads_by_day_type", {
          ...params,
          since: PROJECTS_BASELINE.date,
        }),
      ]);
      setSummary(sum[0] ?? null);
      setByGrade(grades);
      setByTeamLeader(tls);
      setDistribution(dist);
      setBySessionType(sessTypes);
      setStudents(list);
      setNotStarted(notStartedList);
      setOptions({
        teamLeaders: opts.filter((o) => o.kind === "team_leader").map((o) => o.value),
        grades: opts.filter((o) => o.kind === "grade").map((o) => o.value),
      });
      setTrend(((snaps as { data?: SnapshotRow[] })?.data ?? []) as SnapshotRow[]);
      setUploadsByDay(uploads);
      setUploadsByDayType(uploadsTyped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [teamLeader, grade, search]);

  useEffect(() => {
    load();
  }, [load]);

  return { summary, byGrade, byTeamLeader, distribution, bySessionType, students, notStarted, options, trend, uploadsByDay, uploadsByDayType, loading, error, refetch: load };
}
