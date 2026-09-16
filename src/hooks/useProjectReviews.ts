import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { runReplicaQuery } from "@/hooks/useReplicaQuery";
import { statusPoints, type EvalStatus } from "@/lib/projectEvaluation";

const db = () => supabase as any;

export type ProjectEvaluation = {
  id: string;
  project_id: number;
  check_access: boolean;
  check_evidence: boolean;
  check_core_function: boolean;
  status: EvalStatus;
  points: number;
  note: string | null;
  evidence_url: string | null;
  student_external_id: string | null;
  student_name: string | null;
  project_title: string | null;
  project_created_at: string | null;
  tutor_external_id: string | null;
  tutor_name: string | null;
  team_leader: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type EvaluationInput = {
  project_id: number;
  check_access: boolean;
  check_evidence: boolean;
  check_core_function: boolean;
  status: EvalStatus;
  note: string;
  evidence_url: string;
  student_external_id?: string | null;
  student_name?: string | null;
  tutor_external_id?: string | null;
  tutor_name?: string | null;
  team_leader?: string | null;
  project_title?: string | null;
  project_created_at?: string | null;
};

async function currentReviewer() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;
  let name: string | null = null;
  if (uid) {
    const { data } = await supabase.from("profiles").select("full_name").eq("user_id", uid).maybeSingle();
    name = data?.full_name ?? null;
  }
  return { uid, name };
}

/** Saves one Phase 1 evaluation and marks the matching assignment done. */
export async function saveEvaluation(input: EvaluationInput) {
  const { uid, name } = await currentReviewer();
  const payload = {
    project_id: input.project_id,
    check_access: input.check_access,
    check_evidence: input.check_evidence,
    check_core_function: input.check_core_function,
    status: input.status,
    points: statusPoints(input.status),
    note: input.note || null,
    evidence_url: input.evidence_url || null,
    student_external_id: input.student_external_id ?? null,
    student_name: input.student_name ?? null,
    tutor_external_id: input.tutor_external_id ?? null,
    tutor_name: input.tutor_name ?? null,
    team_leader: input.team_leader ?? null,
    project_title: input.project_title ?? null,
    project_created_at: input.project_created_at ?? null,
    reviewed_by: uid,
    reviewed_by_name: name,
  };
  const { error } = await db().from("project_evaluations").upsert(payload, { onConflict: "project_id" });
  if (error) throw new Error(error.message);

  await db()
    .from("project_review_assignments")
    .update({ state: input.status === "pending" ? "open" : "done", completed_at: new Date().toISOString() })
    .eq("project_id", input.project_id);
}

/** Evaluations for a set of projects, keyed by project id. */
export function useEvaluations(projectIds: number[]) {
  const [map, setMap] = useState<Record<number, ProjectEvaluation>>({});
  const key = JSON.stringify(projectIds);

  const load = useCallback(async () => {
    const ids: number[] = JSON.parse(key);
    if (!ids.length) return setMap({});
    const { data } = await db().from("project_evaluations").select("*").in("project_id", ids);
    const next: Record<number, ProjectEvaluation> = {};
    for (const row of (data ?? []) as ProjectEvaluation[]) next[Number(row.project_id)] = row;
    setMap(next);
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { evaluations: map, refetch: load };
}

export type Assignment = {
  id: string;
  project_id: number;
  assigned_to: string;
  assigned_to_name: string | null;
  assigned_on: string;
  state: "open" | "done" | "released";
  student_external_id: string | null;
  student_name: string | null;
  grade: string | null;
  tutor_external_id: string | null;
  tutor_name: string | null;
  team_leader: string | null;
  project_title: string | null;
  project_created_at: string | null;
  completed_at: string | null;
};

/** The signed-in reviewer's queue: today's batch plus anything still open. */
export function useMyAssignments() {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data } = await db()
      .from("project_review_assignments")
      .select("*")
      .eq("assigned_to", uid)
      .order("state", { ascending: true })
      .order("assigned_on", { ascending: true });
    setRows((data ?? []) as Assignment[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const open = rows.filter((r) => r.state === "open");
  const doneToday = rows.filter((r) => r.state === "done" && (r.completed_at ?? "").slice(0, 10) === today);

  return { rows, open, doneToday, loading, refetch: load };
}

/** Admin view of every assignment plus the daily limit setting. */
export function useAssignmentAdmin(enabled: boolean) {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [limit, setLimit] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const [{ data: assigns }, { data: setting }] = await Promise.all([
      db()
        .from("project_review_assignments")
        .select("*")
        .order("assigned_on", { ascending: false })
        .limit(1000),
      db().from("app_settings").select("value").eq("key", "project_review_daily_limit").maybeSingle(),
    ]);
    setRows((assigns ?? []) as Assignment[]);
    if (setting?.value) setLimit(Number(setting.value) || 10);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const saveLimit = useCallback(async (value: number) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await db()
      .from("app_settings")
      .upsert(
        { key: "project_review_daily_limit", value: String(value), updated_by: auth?.user?.id ?? null },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    setLimit(value);
  }, []);

  const generate = useCallback(async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("assign-project-reviews", { body: {} });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      await load();
      return data as { assigned: number; reviewers: number; message?: string };
    } finally {
      setRunning(false);
    }
  }, [load]);

  const release = useCallback(
    async (id: string) => {
      const { error } = await db().from("project_review_assignments").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await load();
    },
    [load],
  );

  const reassign = useCallback(
    async (id: string, userId: string, name: string | null) => {
      const { error } = await db()
        .from("project_review_assignments")
        .update({ assigned_to: userId, assigned_to_name: name, state: "open" })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await load();
    },
    [load],
  );

  const byReviewer = useMemo(() => {
    const map = new Map<string, { name: string; open: number; done: number }>();
    for (const r of rows) {
      const entry = map.get(r.assigned_to) ?? { name: r.assigned_to_name || "Reviewer", open: 0, done: 0 };
      if (r.state === "open") entry.open += 1;
      if (r.state === "done") entry.done += 1;
      map.set(r.assigned_to, entry);
    }
    return [...map.entries()].map(([userId, v]) => ({ userId, ...v }));
  }, [rows]);

  return { rows, byReviewer, limit, loading, running, saveLimit, generate, release, reassign, refetch: load };
}

export type CoverageRow = {
  tutor_tid: string | null;
  tutor_name: string | null;
  team_leader: string;
  eligible_students: number;
  uploaded_students: number;
};

/** Phase 1 numbers for a month: coverage from the replica, functionality from our evaluations. */
export function usePhase1Summary(month: string, teamLeader: string) {
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [evals, setEvals] = useState<ProjectEvaluation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    const from = `${month}-01`;
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    return { from, to: end.toISOString().slice(0, 10) };
  }, [month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cov, ev] = await Promise.all([
        runReplicaQuery<CoverageRow>("project_phase1_coverage", {
          date_from: range.from,
          date_to: range.to,
          team_lead: teamLeader || null,
        }),
        db()
          .from("project_evaluations")
          .select("*")
          .gte("created_at", `${range.from}T00:00:00Z`)
          .lte("created_at", `${range.to}T23:59:59Z`),
      ]);
      setCoverage(cov);
      let list = (ev.data ?? []) as ProjectEvaluation[];
      if (teamLeader) list = list.filter((e) => e.team_leader === teamLeader);
      setEvals(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Phase 1 numbers");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, teamLeader]);

  useEffect(() => {
    load();
  }, [load]);

  const perTutor = useMemo(() => {
    const evalByTutor = new Map<string, { points: number; max: number; reviewed: number }>();
    for (const e of evals) {
      if (e.status === "pending") continue;
      const key = e.tutor_external_id ?? "—";
      const entry = evalByTutor.get(key) ?? { points: 0, max: 0, reviewed: 0 };
      entry.points += Number(e.points ?? 0);
      entry.max += 5;
      entry.reviewed += 1;
      evalByTutor.set(key, entry);
    }
    return coverage.map((c) => {
      const e = evalByTutor.get(c.tutor_tid ?? "—");
      const coveragePct = c.eligible_students ? (c.uploaded_students / c.eligible_students) * 100 : 0;
      const funcPct = e && e.max ? (e.points / e.max) * 100 : null;
      return {
        ...c,
        coveragePct,
        reviewed: e?.reviewed ?? 0,
        funcPct,
        outcome: funcPct === null ? null : coveragePct * 0.4 + funcPct * 0.6,
      };
    });
  }, [coverage, evals]);

  const totals = useMemo(() => {
    const eligible = coverage.reduce((s, c) => s + Number(c.eligible_students), 0);
    const uploaded = coverage.reduce((s, c) => s + Number(c.uploaded_students), 0);
    const scored = evals.filter((e) => e.status !== "pending");
    const points = scored.reduce((s, e) => s + Number(e.points ?? 0), 0);
    const max = scored.length * 5;
    const coveragePct = eligible ? (uploaded / eligible) * 100 : 0;
    const funcPct = max ? (points / max) * 100 : null;
    return {
      eligible,
      uploaded,
      reviewed: scored.length,
      pending: evals.length - scored.length,
      coveragePct,
      funcPct,
      outcome: funcPct === null ? null : coveragePct * 0.4 + funcPct * 0.6,
    };
  }, [coverage, evals]);

  return { perTutor, totals, loading, error, refetch: load, range };
}
