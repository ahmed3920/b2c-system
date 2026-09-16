import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EvalStatus } from "@/lib/projectEvaluation";
import type { ProjectEvaluation } from "@/hooks/useProjectReviews";

const db = () => supabase as any;
const CHUNK = 1000;

export type ReviewedFilters = {
  from: string; // yyyy-mm-dd, review date
  to: string;
  teamLeader: string; // "" = all
  reviewer: string; // reviewed_by uuid, "" = all
  status: EvalStatus | ""; // "" = all
  search: string;
};

export const EMPTY_REVIEWED_FILTERS: ReviewedFilters = {
  from: "",
  to: "",
  teamLeader: "",
  reviewer: "",
  status: "",
  search: "",
};

/** Every saved Phase 1 evaluation ("reviewed project"), filtered client-side. */
export function useReviewedProjects(filters: ReviewedFilters) {
  const [all, setAll] = useState<ProjectEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out: ProjectEvaluation[] = [];
      for (let page = 0; ; page += 1) {
        const { data, error: err } = await db()
          .from("project_evaluations")
          .select("*")
          .order("created_at", { ascending: false })
          .range(page * CHUNK, page * CHUNK + CHUNK - 1);
        if (err) throw new Error(err.message);
        const rows = (data ?? []) as ProjectEvaluation[];
        out.push(...rows);
        if (rows.length < CHUNK) break;
      }
      setAll(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reviewed projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return all.filter((r) => {
      const day = (r.created_at ?? "").slice(0, 10);
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
      if (filters.teamLeader && r.team_leader !== filters.teamLeader) return false;
      if (filters.reviewer && r.reviewed_by !== filters.reviewer) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (term) {
        const hay = [
          r.project_title,
          r.student_name,
          r.student_external_id,
          r.tutor_name,
          r.tutor_external_id,
          String(r.project_id),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [all, filters]);

  const options = useMemo(() => {
    const tls = new Set<string>();
    const reviewers = new Map<string, string>();
    for (const r of all) {
      if (r.team_leader) tls.add(r.team_leader);
      if (r.reviewed_by) reviewers.set(r.reviewed_by, r.reviewed_by_name || "Reviewer");
    }
    return {
      teamLeaders: [...tls].sort(),
      reviewers: [...reviewers.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [all]);

  return { rows, total: all.length, options, loading, error, refetch: load };
}

export type ReviewedAnalysis = ReturnType<typeof analyseReviewed>;

/** Chart-ready aggregations over a set of reviewed projects. */
export function analyseReviewed(rows: ProjectEvaluation[]) {
  const statusOrder: EvalStatus[] = [
    "fully_working",
    "partially_working",
    "not_working",
    "invalid_submission",
    "pending",
  ];

  const byStatus = statusOrder.map((s) => ({
    status: s,
    value: rows.filter((r) => r.status === s).length,
  }));

  const dayMap = new Map<string, number>();
  for (const r of rows) {
    const d = (r.created_at ?? "").slice(0, 10);
    if (d) dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
  }
  const byDay = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, total]) => ({ day, total }));

  const tlMap = new Map<
    string,
    { team_leader: string; total: number; fully: number; partial: number; failed: number; points: number }
  >();
  for (const r of rows) {
    const key = r.team_leader || "Unassigned";
    const e =
      tlMap.get(key) ?? { team_leader: key, total: 0, fully: 0, partial: 0, failed: 0, points: 0 };
    e.total += 1;
    e.points += Number(r.points) || 0;
    if (r.status === "fully_working") e.fully += 1;
    else if (r.status === "partially_working") e.partial += 1;
    else if (r.status === "not_working" || r.status === "invalid_submission") e.failed += 1;
    tlMap.set(key, e);
  }
  const byTeamLeader = [...tlMap.values()]
    .map((e) => ({
      ...e,
      avg_points: e.total ? Number((e.points / e.total).toFixed(2)) : 0,
      pass_rate: e.total ? Number(((e.fully / e.total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const revMap = new Map<string, { reviewer: string; total: number }>();
  for (const r of rows) {
    const key = r.reviewed_by_name || "Unknown";
    const e = revMap.get(key) ?? { reviewer: key, total: 0 };
    e.total += 1;
    revMap.set(key, e);
  }
  const byReviewer = [...revMap.values()].sort((a, b) => b.total - a.total).slice(0, 15);

  const tutorMap = new Map<string, { tutor: string; total: number; failed: number; points: number }>();
  for (const r of rows) {
    const key = r.tutor_name || r.tutor_external_id || "Unknown";
    const e = tutorMap.get(key) ?? { tutor: key, total: 0, failed: 0, points: 0 };
    e.total += 1;
    e.points += Number(r.points) || 0;
    if (r.status === "not_working" || r.status === "invalid_submission") e.failed += 1;
    tutorMap.set(key, e);
  }
  const byTutor = [...tutorMap.values()]
    .map((e) => ({ ...e, avg_points: e.total ? Number((e.points / e.total).toFixed(2)) : 0 }))
    .sort((a, b) => b.total - a.total);

  const totalPoints = rows.reduce((sum, r) => sum + (Number(r.points) || 0), 0);
  const fully = rows.filter((r) => r.status === "fully_working").length;
  const failed = rows.filter(
    (r) => r.status === "not_working" || r.status === "invalid_submission",
  ).length;
  const pendingRecheck = rows.filter((r) => r.status === "pending").length;

  return {
    total: rows.length,
    students: new Set(rows.map((r) => r.student_external_id).filter(Boolean)).size,
    tutors: new Set(rows.map((r) => r.tutor_external_id || r.tutor_name).filter(Boolean)).size,
    reviewers: new Set(rows.map((r) => r.reviewed_by).filter(Boolean)).size,
    avgPoints: rows.length ? Number((totalPoints / rows.length).toFixed(2)) : 0,
    passRate: rows.length ? Number(((fully / rows.length) * 100).toFixed(1)) : 0,
    failRate: rows.length ? Number(((failed / rows.length) * 100).toFixed(1)) : 0,
    pendingRecheck,
    byStatus,
    byDay,
    byTeamLeader,
    byReviewer,
    byTutor,
  };
}
