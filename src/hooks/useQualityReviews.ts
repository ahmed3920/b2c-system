import { useMemo, useState } from "react";
import { useReplicaQuery } from "@/hooks/useReplicaQuery";

export type QualityFilters = {
  date_from: string;
  date_to: string;
  team_lead: string;
  tutor: string;
  session_type: string;
  status: string;
  min_score: string;
  max_score: string;
  review_cycle: string;
  tutor_status: string;
  organization: string;
  flag: string;
};

export const emptyQualityFilters: QualityFilters = {
  date_from: "",
  date_to: "",
  team_lead: "",
  tutor: "",
  session_type: "",
  status: "1",
  min_score: "",
  max_score: "",
  review_cycle: "",
  tutor_status: "",
  organization: "",
  flag: "",
};

export type QualityReviewRow = {
  id: string;
  score: string | null;
  score_pct: string | null;
  status: string | null;
  session_type: string | null;
  session_start_at: string | null;
  submission_date: string | null;
  duration: number | null;
  phase_number: number | null;
  review_cycle: number | string | null;
  has_flags: boolean;
  red_flags: number;
  yellow_flags: number;
  flag_level: string | null;
  remarkable_session: boolean;
  needs_coaching: boolean;
  needs_immediate_action: boolean;
  has_pending_objections: boolean;
  quality_objections_count: number | null;
  tutor_tid: string | null;
  tutor_name: string | null;
  tutor_status: number | null;
  team_leader: string | null;
  mentor_name: string | null;
  organizations: string | null;
  lesson_name: string | null;
};

export type QualitySummary = {
  total: number;
  avg_score: string | null;
  avg_score_pct: string | null;
  needs_coaching: number;
  needs_immediate_action: number;
  remarkable: number;
  flagged: number;
  red_flagged: number;
  yellow_flagged: number;
  pending_objections: number;
  tutors: number;
  team_leaders: number;
};

export type QualityFilterOptions = {
  team_leaders: string[] | null;
  organizations: string[] | null;
  tutor_statuses: number[] | null;
  session_types: string[] | null;
  statuses: string[] | null;
  review_cycles: string[] | null;
  criteria: string[] | null;
};

export const PAGE_SIZE = 50;

export function statusLabel(status: string | null | undefined) {
  if (status === "1") return "Submitted";
  if (status === "0") return "Pending";
  return status ?? "—";
}

export function toBaseParams(filters: QualityFilters) {
  return {
    date_from: filters.date_from || null,
    date_to: filters.date_to || null,
    team_lead: filters.team_lead || null,
    tutor: filters.tutor || null,
    session_type: filters.session_type || null,
    status: filters.status || null,
    min_score: filters.min_score || null,
    max_score: filters.max_score || null,
    review_cycle: filters.review_cycle || null,
    tutor_status: filters.tutor_status === "" ? null : Number(filters.tutor_status),
    organization: filters.organization || null,
    flag: filters.flag || null,
  };
}


/** Shared filter state + options, without any list query attached. */
export function useQualityFilters(initial: QualityFilters = emptyQualityFilters) {
  const [filters, setFilters] = useState<QualityFilters>(initial);
  const [page, setPage] = useState(0);
  const baseParams = useMemo(() => toBaseParams(filters), [filters]);
  // Options depend on the current filters so every dropdown only lists
  // values that exist among the currently matching reviews.
  const options = useReplicaQuery<QualityFilterOptions>("quality_filter_options", baseParams);

  const update = (patch: Partial<QualityFilters>) => {
    setPage(0);
    setFilters((f) => ({ ...f, ...patch }));
  };
  const reset = () => {
    setPage(0);
    setFilters(initial);
  };

  return { filters, update, reset, page, setPage, baseParams, options: options.rows[0] };
}

export function useQualityReviews() {
  const f = useQualityFilters();

  const listParams = useMemo(
    () => ({ ...f.baseParams, limit: PAGE_SIZE, offset: f.page * PAGE_SIZE }),
    [f.baseParams, f.page],
  );

  const list = useReplicaQuery<QualityReviewRow>("quality_reviews_list", listParams);
  const summary = useReplicaQuery<QualitySummary>("quality_reviews_count", f.baseParams);

  return {
    ...f,
    rows: list.rows,
    loading: list.loading,
    error: list.error,
    refetch: () => {
      list.refetch();
      summary.refetch();
    },
    summary: summary.rows[0],
    summaryLoading: summary.loading,
  };
}
