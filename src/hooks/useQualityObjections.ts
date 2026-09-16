import { useMemo, useState } from "react";
import { useReplicaQuery } from "@/hooks/useReplicaQuery";
import { useQualityFilters, emptyQualityFilters, PAGE_SIZE } from "@/hooks/useQualityReviews";

export type ObjectionStage =
  | "pending_tl"
  | "pending_qc"
  | "pending_qtl"
  | "pending_edit"
  | "pending_qtl_confirm"
  | "accepted"
  | "rejected_qtl"
  | "rejected_tl"
  | "other";

export type ObjectionOutcome = "pending" | "accepted" | "rejected";

export type ObjectionRow = {
  id: string;
  status: number;
  stage: ObjectionStage;
  outcome: ObjectionOutcome;
  objectionable_type: string;
  item_kind: string | null;
  item_text: string | null;
  item_removed: boolean;
  description: string | null;
  response: string | null;
  created_at: string | null;
  updated_at: string | null;
  resolution_date: string | null;
  edu_deadline: string | null;
  qc_deadline: string | null;
  qlead_deadline: string | null;
  last_action_log: string | null;
  last_actor_name: string | null;
  last_actor_role: string | null;
  last_action_at: string | null;
  days_waiting: string | null;
  review_id: string;
  score: string | null;
  score_pct: string | null;
  session_start_at: string | null;
  review_cycle: string | null;
  session_type: string | null;
  tutor_tid: string | null;
  tutor_name: string | null;
  team_leader: string | null;
  mentor_name: string | null;
  reviewer_name: string | null;
};

export type ObjectionSummary = {
  total: number;
  pending: number;
  pending_tl: number;
  pending_qc: number;
  pending_qtl: number;
  accepted: number;
  rejected: number;
  rejected_tl: number;
  rejected_qtl: number;
  comments: number;
  flags: number;
  items_removed: number;
  reviews: number;
  tutors: number;
  pending_tl_reviews: number;
  pending_tl_tutors: number;
  pending_qc_reviews: number;
  pending_qc_tutors: number;
  pending_qtl_reviews: number;
  pending_qtl_tutors: number;
  avg_days: string | null;
  pending_tl_avg_days: string | null;
  pending_tl_overdue: number;
  pending_qc_avg_days: string | null;
  pending_qc_overdue: number;
  pending_qtl_avg_days: string | null;
  pending_qtl_overdue: number;
  tl_accepted: number;
  tl_rejected: number;
  qc_accepted: number;
  qc_rejected: number;
  qtl_accepted: number;
  qtl_rejected: number;
};

export type ObjectionSlaRow = {
  id: string;
  created_at: string | null;
  tl_days: string | null;
  qc_days: string | null;
  qtl_days: string | null;
  total_days: string | null;
  closed: boolean;
};

export type ObjectionSlaSummary = {
  resolved: number;
  open: number;
  closed_tl_avg_days: string | null;
  closed_qc_avg_days: string | null;
  closed_qtl_avg_days: string | null;
  closed_total_avg_days: string | null;
  all_tl_avg_days: string | null;
  all_qc_avg_days: string | null;
  all_qtl_avg_days: string | null;
  all_total_avg_days: string | null;
};

export type ObjectionByTeamLeader = {
  team_leader: string;
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
};

export const STAGE_LABEL: Record<string, string> = {
  pending_tl: "Pending — Team Leader",
  pending_qc: "Pending — Quality Coordinator",
  pending_qtl: "Pending — Quality Team Leader",
  pending_edit: "Pending — review edit (QC)",
  pending_qtl_confirm: "Pending — QTL confirmation",
  accepted: "Resolved — accepted",
  rejected_qtl: "Rejected by Quality Team Leader",
  rejected_tl: "Rejected by Team Leader",
  other: "Other",
};

export const ROLE_LABEL: Record<string, string> = {
  tutor: "Tutor",
  team_leader: "Team Leader",
  quality_coordinator: "Quality Coordinator",
  quality_team_leader: "Quality Team Leader",
  system: "System",
};

/** Objections raised by tutors on their quality reviews (read-only from iSchool). */
export function useQualityObjections() {
  // Objections exist on reviews in every status, so we don't pre-filter by it.
  const f = useQualityFilters({ ...emptyQualityFilters, status: "" });
  const [stage, setStage] = useState("");
  const [outcome, setOutcome] = useState("");
  const [search, setSearch] = useState("");

  const objParams = useMemo(
    () => ({
      ...f.baseParams,
      stage: stage || null,
      outcome: outcome || null,
      search: search || null,
    }),
    [f.baseParams, stage, outcome, search],
  );

  const listParams = useMemo(
    () => ({ ...objParams, limit: PAGE_SIZE, offset: f.page * PAGE_SIZE }),
    [objParams, f.page],
  );

  const list = useReplicaQuery<ObjectionRow>("quality_objections_list", listParams);
  const summary = useReplicaQuery<ObjectionSummary>("quality_objections_count", objParams);
  const byTeamLeader = useReplicaQuery<ObjectionByTeamLeader>("quality_objections_by_team_leader", objParams);
  const slaRows = useReplicaQuery<ObjectionSlaRow>("quality_objections_sla_rows", listParams);
  const slaSummary = useReplicaQuery<ObjectionSlaSummary>("quality_objections_sla_summary", objParams);

  const slaById = useMemo(() => {
    const m = new Map<string, ObjectionSlaRow>();
    for (const r of slaRows.rows) m.set(String(r.id), r);
    return m;
  }, [slaRows.rows]);

  return {
    ...f,
    stage,
    setStage,
    outcome,
    setOutcome,
    search,
    setSearch,
    objParams,
    rows: list.rows,
    loading: list.loading,
    error: list.error,
    summary: summary.rows[0],
    summaryLoading: summary.loading,
    teamLeaders: byTeamLeader.rows,
    teamLeadersLoading: byTeamLeader.loading,
    slaById,
    slaLoading: slaRows.loading,
    sla: slaSummary.rows[0],
    slaSummaryLoading: slaSummary.loading,
    refetch: () => {
      list.refetch();
      summary.refetch();
      byTeamLeader.refetch();
      slaRows.refetch();
      slaSummary.refetch();
    },
  };
}
