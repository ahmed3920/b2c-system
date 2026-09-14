import { useCallback, useEffect, useMemo, useState } from "react";
import { runReplicaQuery } from "@/hooks/useReplicaQuery";
import { supabase } from "@/integrations/supabase/client";

export type ProjectRow = {
  project_id: number;
  title: string | null;
  description: string | null;
  url: string | null;
  created_at: string;
  published: boolean | null;
  archived: boolean | null;
  project_status: number | null;
  project_type: number | null;
  final_score: number | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  tutor_comment: string | null;
  student_id: number;
  s_id: string | null;
  student_name: string | null;
  grade: string | null;
  tutor_tid: string | null;
  tutor_name: string | null;
  team_leader: string;
  module: string | null;
  lesson: string | null;
  session_id: number | null;
  session_start_at: string | null;
  cover_key: string | null;
  cover_content_type: string | null;
  cover_filename: string | null;
};

export type ProjectAttachment = {
  attachment_id: number;
  kind: string;
  key: string;
  filename: string;
  content_type: string | null;
  byte_size: number;
  created_at: string;
};

export type SignedFile = { url: string; filename: string; content_type: string | null };

/** Asks the backend for short-lived signed links to files (images, code file, deck). */
export async function signProjectFiles(
  items: { project_id: number; key: string }[],
  download = false,
): Promise<Record<string, SignedFile>> {
  if (!items.length) return {};
  const { data, error } = await supabase.functions.invoke("project-file-url", {
    body: { items, download },
  });
  if (data?.error) throw new Error(data.error);
  if (error) throw new Error("Project files are unavailable right now.");
  return (data?.files ?? {}) as Record<string, SignedFile>;
}

/** Files attached to one project, with signed preview links for the images. */
export function useProjectFiles(projectId: number | null) {
  const [files, setFiles] = useState<ProjectAttachment[]>([]);
  const [urls, setUrls] = useState<Record<string, SignedFile>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!projectId) {
      setFiles([]);
      setUrls({});
      return;
    }
    setLoading(true);
    setError(null);
    runReplicaQuery<ProjectAttachment>("project_attachments", { project_id: projectId })
      .then(async (rows) => {
        if (!active) return;
        setFiles(rows);
        const images = rows.filter((r) => (r.content_type ?? "").startsWith("image/"));
        if (images.length) {
          try {
            const signed = await signProjectFiles(
              images.map((r) => ({ project_id: projectId, key: r.key })),
            );
            if (active) setUrls(signed);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Could not load previews";
            if (active) setError(msg.includes("credentials") ? "File storage is not connected yet" : msg);
          }
        } else if (active) {
          setUrls({});
        }
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load files"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [projectId]);

  return { files, urls, loading, error };
}

export type ProjectSummary = {
  projects: number;
  students: number;
  published: number;
  archived: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
};

export type EngagementStudentRow = {
  s_id: string | null;
  student_name: string | null;
  grade: string | null;
  team_leader: string;
  tutor_name: string | null;
  projects: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
};

export type EngagementGroupRow = {
  grade?: string;
  team_leader?: string;
  projects: number;
  students: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
};

export type StudentDashboardRow = {
  student_id: number;
  s_id: string | null;
  student_name: string | null;
  grade: string | null;
  team_leader: string;
  tutor_name: string | null;
  tutor_tid: string | null;
  attended_sessions: number;
  projects: number;
  last_upload: string | null;
  stalled: boolean;
};

export type StudentProjectRow = {
  project_id: number;
  title: string | null;
  description: string | null;
  url: string | null;
  created_at: string;
  published: boolean | null;
  archived: boolean | null;
  project_status: number | null;
  final_score: number | null;
  views_count: number | null;
  likes_count: number | null;
  comments_count: number | null;
  module: string | null;
  lesson: string | null;
};

export type StudentSessionRow = {
  session_id: number;
  start_at: string | null;
  status: number | null;
  is_student_absent: boolean | null;
  group_session_id: number | null;
  tutor_tid: string | null;
  tutor_name: string | null;
  lesson: string | null;
  module: string | null;
  projects: number;
};

export type Decision = {
  id: string;
  project_id: number;
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
};

export type ProjectFilters = {
  dateFrom: string;
  dateTo: string;
  teamLeader: string;
  grade: string;
  search: string;
  published: string;
};

export const EMPTY_FILTERS: ProjectFilters = {
  dateFrom: "",
  dateTo: "",
  teamLeader: "",
  grade: "",
  search: "",
  published: "",
};

const n = (v: string) => (v && v !== "" && v !== "all" ? v : null);

function toParams(f: ProjectFilters) {
  return {
    date_from: n(f.dateFrom),
    date_to: n(f.dateTo),
    team_lead: n(f.teamLeader),
    grade: n(f.grade),
    search: n(f.search),
    published: n(f.published),
  };
}

export const PAGE_SIZE = 50;

/** Projects list + summary + filter options + our approval decisions. */
export function useProjectAudit(filters: ProjectFilters, page: number, enabled = true) {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [options, setOptions] = useState<{ teamLeaders: string[]; grades: string[] }>({
    teamLeaders: [],
    grades: [],
  });
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify({ ...toParams(filters), page });

  const loadDecisions = useCallback(async (ids: number[]) => {
    if (!ids.length) return setDecisions({});
    const { data } = await (supabase as any)
      .from("project_audit_decisions")
      .select("id, project_id, status, reason, decided_by_name, decided_at")
      .in("project_id", ids);
    const map: Record<number, Decision> = {};
    for (const d of (data ?? []) as Decision[]) map[Number(d.project_id)] = d;
    setDecisions(map);
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    const params = { ...toParams(filters) };
    try {
      const [list, sum, opts] = await Promise.all([
        runReplicaQuery<ProjectRow>("project_audit_list", {
          ...params,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }),
        runReplicaQuery<ProjectSummary>("project_audit_summary", params),
        runReplicaQuery<{ kind: string; value: string }>("project_audit_options", params),
      ]);
      setRows(list);
      setSummary(sum[0] ?? null);
      setOptions({
        teamLeaders: opts.filter((o) => o.kind === "team_leader").map((o) => o.value),
        grades: opts.filter((o) => o.kind === "grade").map((o) => o.value),
      });
      await loadDecisions(list.map((r) => Number(r.project_id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, loadDecisions]);

  useEffect(() => {
    load();
  }, [load]);

  const saveDecision = useCallback(
    async (row: ProjectRow, status: "approved" | "rejected", reason: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      let name: string | null = null;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", uid)
          .maybeSingle();
        name = prof?.full_name ?? null;
      }
      const payload = {
        project_id: row.project_id,
        student_external_id: row.s_id,
        student_name: row.student_name,
        tutor_external_id: row.tutor_tid,
        tutor_name: row.tutor_name,
        team_leader: row.team_leader,
        project_title: row.title,
        status,
        reason: reason || null,
        decided_by: uid,
        decided_by_name: name,
        decided_at: new Date().toISOString(),
      };
      const { error: err } = await (supabase as any)
        .from("project_audit_decisions")
        .upsert(payload, { onConflict: "project_id" });
      if (err) throw new Error(err.message);
      await loadDecisions(rows.map((r) => Number(r.project_id)));
    },
    [rows, loadDecisions],
  );

  return { rows, summary, options, decisions, loading, error, refetch: load, saveDecision };
}

/** Engagement aggregates. */
export function useProjectEngagement(filters: ProjectFilters, enabled = true) {
  const [students, setStudents] = useState<EngagementStudentRow[]>([]);
  const [byGrade, setByGrade] = useState<EngagementGroupRow[]>([]);
  const [byTeamLeader, setByTeamLeader] = useState<EngagementGroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(toParams(filters));

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    const params = JSON.parse(key);
    try {
      const [st, g, tl] = await Promise.all([
        runReplicaQuery<EngagementStudentRow>("project_engagement_students", {
          ...params,
          limit: 200,
          offset: 0,
        }),
        runReplicaQuery<EngagementGroupRow>("project_engagement_by_grade", params),
        runReplicaQuery<EngagementGroupRow>("project_engagement_by_team_leader", params),
      ]);
      setStudents(st);
      setByGrade(g);
      setByTeamLeader(tl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load engagement");
    } finally {
      setLoading(false);
    }
  }, [key, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { students, byGrade, byTeamLeader, loading, error, refetch: load };
}

/** Student dashboard list. */
export function useProjectStudents(
  filters: { teamLeader: string; grade: string; search: string; stalledOnly: boolean },
  page: number,
  enabled = true,
) {
  const [rows, setRows] = useState<StudentDashboardRow[]>([]);
  const [summary, setSummary] = useState<{
    students: number;
    projects: number | null;
    zero_projects: number;
    stalled: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      team_lead: n(filters.teamLeader),
      grade: n(filters.grade),
      search: n(filters.search),
      stalled_only: filters.stalledOnly ? "yes" : null,
    }),
    [filters.teamLeader, filters.grade, filters.search, filters.stalledOnly],
  );
  const key = JSON.stringify({ params, page });

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    const { params: p, page: pg } = JSON.parse(key);
    try {
      const [list, sum] = await Promise.all([
        runReplicaQuery<StudentDashboardRow>("project_students_list", {
          ...p,
          limit: PAGE_SIZE,
          offset: pg * PAGE_SIZE,
        }),
        runReplicaQuery<{ students: number; projects: number | null; zero_projects: number; stalled: number }>(
          "project_students_summary",
          p,
        ),
      ]);
      setRows(list);
      setSummary(sum[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load students");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [key, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, summary, loading, error, refetch: load };
}

/** One student's projects + session history. */
export function useStudentDetail(studentId: number | null) {
  const [projects, setProjects] = useState<StudentProjectRow[]>([]);
  const [sessions, setSessions] = useState<StudentSessionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!studentId) {
      setProjects([]);
      setSessions([]);
      return;
    }
    setLoading(true);
    Promise.all([
      runReplicaQuery<StudentProjectRow>("project_student_projects", { student_id: studentId }),
      runReplicaQuery<StudentSessionRow>("project_student_sessions", { student_id: studentId }),
    ])
      .then(([p, s]) => {
        if (!cancelled) {
          setProjects(p);
          setSessions(s);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return { projects, sessions, loading };
}
