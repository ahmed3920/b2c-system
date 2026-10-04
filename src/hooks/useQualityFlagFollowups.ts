import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useReplicaQuery, runReplicaQuery } from "@/hooks/useReplicaQuery";
import { downloadCsv } from "@/lib/exportCsv";
import { useQualityScope } from "@/hooks/useQualityScope";
import type { QualityFilterOptions } from "@/hooks/useQualityReviews";

export type FlagRow = {
  flag_id: string;
  review_id: string;
  flag_type: number;
  flag_color: "red" | "yellow" | "other";
  description: string | null;
  flag_status: string | null;
  created_at: string | null;
  criterion_name: string | null;
  parent_name: string | null;
  score: number | null;
  score_pct: string | null;
  session_start_at: string | null;
  review_cycle: string | null;
  tutor_tid: string | null;
  tutor_name: string | null;
  tutor_status: number | null;
  team_leader: string | null;
  mentor_name: string | null;
  organizations: string | null;
  reviewer_name?: string | null;
  objection_id: string | null;
  objection_stage: string | null;
  objection_outcome: "pending" | "accepted" | "rejected" | null;
  objection_decided_by: "tl" | "qc" | "qtl" | "other" | null;
  review_objections_count: number | null;
};

export const ROLE_SHORT: Record<string, string> = { tl: "TL", qc: "QC", qtl: "QTL" };

export function stageWaitingOn(stage: string | null): string | null {
  if (stage === "pending_tl") return "TL";
  if (stage === "pending_qc") return "QC";
  if (stage === "pending_qtl" || stage === "pending_edit" || stage === "pending_qtl_confirm") return "QTL";
  return null;
}

export type FollowupStatus = "open" | "in_progress" | "done";

export type Followup = {
  flag_id: string;
  status: FollowupStatus;
  note: string | null;
  updated_at: string | null;
};

export const FOLLOWUP_STATUS_LABEL: Record<FollowupStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

export type FlagFilters = {
  cycle: string;
  team_lead: string;
  tutor: string;
  flag_type: "2" | "1" | "";
  followup: FollowupStatus | "all";
  objection: "all" | "yes" | "no";
};

export const emptyFlagFilters: FlagFilters = {
  cycle: "",
  team_lead: "",
  tutor: "",
  flag_type: "2",
  followup: "all",
  objection: "all",
};

export const FLAG_PAGE_SIZE = 100;

/** Red / yellow flagged reviews plus the locally stored follow-up notes. */
export function useQualityFlagFollowups() {
  const scope = useQualityScope();
  const [filters, setFilters] = useState<FlagFilters>(emptyFlagFilters);
  const [page, setPage] = useState(0);
  const [followups, setFollowups] = useState<Record<string, Followup>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const baseParams = useMemo(() => {
    const p: Record<string, unknown> = {
      date_from: null, date_to: null, team_lead: filters.team_lead || null,
      tutor: filters.tutor || null, session_type: null, status: null,
      min_score: null, max_score: null,
      review_cycle: filters.cycle || null,
      tutor_status: null, organization: null, flag: null, student: null, mentor: null,
      flag_type: filters.flag_type === "" ? null : Number(filters.flag_type),
      has_objection: filters.objection === "all" ? null : filters.objection,
    };
    if (scope.loading) return { ...p, team_lead: "__loading__" };
    if (scope.lockedTeamLead) p.team_lead = scope.lockedTeamLead;
    if (scope.lockedMentor) p.mentor = scope.lockedMentor;
    return p;
  }, [filters, scope.loading, scope.lockedTeamLead, scope.lockedMentor]);

  const listParams = useMemo(
    () => ({ ...baseParams, limit: FLAG_PAGE_SIZE, offset: page * FLAG_PAGE_SIZE }),
    [baseParams, page],
  );

  const list = useReplicaQuery<FlagRow>("quality_flags_list", listParams);
  const count = useReplicaQuery<{ total: number; red: number; yellow: number; tutors: number }>(
    "quality_flags_count",
    baseParams,
  );
  const cycles = useReplicaQuery<{ cycle: string }>("quality_cycles_list", {});

  const optionsParams = useMemo(() => {
    const p: Record<string, unknown> = {
      date_from: null, date_to: null, team_lead: null, tutor: null,
      session_type: null, status: null, min_score: null, max_score: null,
      review_cycle: null, tutor_status: null, organization: null, flag: null,
      student: null, mentor: null,
    };
    if (scope.loading) return { ...p, team_lead: "__loading__" };
    if (scope.lockedTeamLead) p.team_lead = scope.lockedTeamLead;
    if (scope.lockedMentor) p.mentor = scope.lockedMentor;
    return p;
  }, [scope.loading, scope.lockedTeamLead, scope.lockedMentor]);
  const options = useReplicaQuery<QualityFilterOptions>("quality_filter_options", optionsParams);

  // Load the saved notes for the flags currently on screen.
  const flagIds = useMemo(() => list.rows.map((r) => r.flag_id), [list.rows]);
  const flagIdsKey = flagIds.join(",");

  const loadFollowups = useCallback(async () => {
    if (!flagIdsKey) return;
    const ids = flagIdsKey.split(",").map((v) => Number(v)).filter((n) => !Number.isNaN(n));
    const { data } = await (supabase as any)
      .from("quality_flag_followups")
      .select("flag_id, status, note, updated_at")
      .in("flag_id", ids);
    const map: Record<string, Followup> = {};
    for (const row of (data ?? []) as any[]) {
      map[String(row.flag_id)] = {
        flag_id: String(row.flag_id),
        status: (row.status ?? "open") as FollowupStatus,
        note: row.note ?? null,
        updated_at: row.updated_at ?? null,
      };
    }
    setFollowups(map);
  }, [flagIdsKey]);

  useEffect(() => {
    loadFollowups();
  }, [loadFollowups]);

  const save = useCallback(
    async (row: FlagRow, patch: { status?: FollowupStatus; note?: string }) => {
      setSaving(row.flag_id);
      const current = followups[row.flag_id];
      const next: Followup = {
        flag_id: row.flag_id,
        status: patch.status ?? current?.status ?? "open",
        note: patch.note ?? current?.note ?? null,
        updated_at: new Date().toISOString(),
      };
      setFollowups((f) => ({ ...f, [row.flag_id]: next }));
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await (supabase as any)
        .from("quality_flag_followups")
        .upsert(
          {
            flag_id: Number(row.flag_id),
            review_id: Number(row.review_id),
            tutor_tid: row.tutor_tid,
            tutor_name: row.tutor_name,
            team_leader: row.team_leader,
            status: next.status,
            note: next.note,
            created_by: session?.user.id ?? null,
            updated_by: session?.user.id ?? null,
          },
          { onConflict: "flag_id" },
        );
      setSaving(null);
      return error ? error.message : null;
    },
    [followups],
  );

  const [exporting, setExporting] = useState(false);
  const exportAll = useCallback(async (): Promise<string | null> => {
    setExporting(true);
    try {
      const CHUNK = 500;
      const all: FlagRow[] = [];
      for (let offset = 0; offset < 20000; offset += CHUNK) {
        const rows = await runReplicaQuery<FlagRow>("quality_flags_list", { ...baseParams, limit: CHUNK, offset });
        all.push(...rows);
        if (rows.length < CHUNK) break;
      }
      const fu: Record<string, Followup> = {};
      const ids = all.map((r) => Number(r.flag_id)).filter((n) => !Number.isNaN(n));
      for (let i = 0; i < ids.length; i += 300) {
        const { data } = await (supabase as any)
          .from("quality_flag_followups")
          .select("flag_id, status, note, updated_at")
          .in("flag_id", ids.slice(i, i + 300));
        for (const r of (data ?? []) as any[]) {
          fu[String(r.flag_id)] = { flag_id: String(r.flag_id), status: r.status ?? "open", note: r.note ?? null, updated_at: r.updated_at ?? null };
        }
      }
      const rows = all.filter((r) => filters.followup === "all" || (fu[r.flag_id]?.status ?? "open") === filters.followup);
      const outcomeLabel = (r: FlagRow) =>
        !r.objection_id ? "None" : r.objection_outcome === "accepted" ? "Accepted" : r.objection_outcome === "rejected" ? "Rejected" : "Pending";
      downloadCsv(
        `flag-follow-up_${filters.cycle || "all"}_${new Date().toISOString().slice(0, 10)}.csv`,
        ["Tutor", "T-ID", "Team leader", "Mentor", "Reviewer", "Session date", "Cycle", "Score", "Score %", "Flag", "Criterion", "Flag description", "Objection", "Objection stage", "Objection decided by", "Follow-up status", "Action taken", "Last updated"],
        rows.map((r) => {
          const f = fu[r.flag_id];
          return [
            r.tutor_name, r.tutor_tid, r.team_leader, r.mentor_name, r.reviewer_name ?? "",
            r.session_start_at ? r.session_start_at.slice(0, 10) : "", r.review_cycle,
            r.score != null ? Number(r.score).toFixed(2) : "", r.score_pct ?? "",
            r.flag_color === "red" ? "Red" : r.flag_color === "yellow" ? "Yellow" : "Other",
            [r.parent_name, r.criterion_name].filter(Boolean).join(" · "), r.description ?? "",
            outcomeLabel(r),
            r.objection_id ? (stageWaitingOn(r.objection_stage) ? `Waiting on ${stageWaitingOn(r.objection_stage)}` : r.objection_stage ?? "") : "",
            r.objection_decided_by ? (ROLE_SHORT[r.objection_decided_by] ?? "") : "",
            FOLLOWUP_STATUS_LABEL[(f?.status ?? "open") as FollowupStatus], f?.note ?? "",
            f?.updated_at ? f.updated_at.slice(0, 10) : "",
          ];
        }),
      );
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Export failed";
    } finally {
      setExporting(false);
    }
  }, [baseParams, filters.followup, filters.cycle]);

  const update = (patch: Partial<FlagFilters>) => {
    setPage(0);
    setFilters((f) => ({ ...f, ...patch }));
  };
  const reset = () => {
    setPage(0);
    setFilters(emptyFlagFilters);
  };

  const rows = useMemo(() => {
    if (filters.followup === "all") return list.rows;
    return list.rows.filter(
      (r) => (followups[r.flag_id]?.status ?? "open") === filters.followup,
    );
  }, [list.rows, followups, filters.followup]);

  return {
    filters,
    update,
    reset,
    page,
    setPage,
    rows,
    allRows: list.rows,
    loading: list.loading,
    error: list.error,
    totals: count.rows[0],
    cycles: cycles.rows.map((c) => c.cycle),
    options: options.rows[0],
    followups,
    save,
    saving,
    scope,
    exportAll,
    exporting,
    refetch: () => {
      list.refetch();
      count.refetch();
      loadFollowups();
    },
  };
}
