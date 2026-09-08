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
};

export type QualityReviewRow = {
  id: string;
  score: string | null;
  status: string | null;
  session_type: string | null;
  session_start_at: string | null;
  submission_date: string | null;
  duration: number | null;
  phase_number: number | null;
  review_cycle: number | null;
  has_flags: boolean;
  remarkable_session: boolean;
  needs_coaching: boolean;
  needs_immediate_action: boolean;
  has_pending_objections: boolean;
  quality_objections_count: number | null;
  tutor_tid: string | null;
  tutor_name: string | null;
  team_leader: string | null;
  lesson_name: string | null;
};

export type QualitySummary = {
  total: number;
  avg_score: string | null;
  needs_coaching: number;
  needs_immediate_action: number;
  remarkable: number;
  tutors: number;
};

export const PAGE_SIZE = 50;

export function statusLabel(status: string | null | undefined) {
  if (status === "1") return "Submitted";
  if (status === "0") return "Pending";
  return status ?? "—";
}

export function useQualityReviews() {
  const [filters, setFilters] = useState<QualityFilters>(emptyQualityFilters);
  const [page, setPage] = useState(0);

  const baseParams = useMemo(
    () => ({
      date_from: filters.date_from || null,
      date_to: filters.date_to || null,
      team_lead: filters.team_lead || null,
      tutor: filters.tutor || null,
      session_type: filters.session_type || null,
      status: filters.status || null,
      min_score: filters.min_score || null,
      max_score: filters.max_score || null,
      review_cycle: filters.review_cycle || null,
    }),
    [filters],
  );

  const listParams = useMemo(
    () => ({ ...baseParams, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    [baseParams, page],
  );

  const list = useReplicaQuery<QualityReviewRow>("quality_reviews_list", listParams);
  const summary = useReplicaQuery<QualitySummary>("quality_reviews_count", baseParams);
  const options = useReplicaQuery<{
    team_leaders: string[] | null;
    session_types: string[] | null;
    statuses: string[] | null;
    review_cycles: string[] | null;
  }>("quality_filter_options");

  const update = (patch: Partial<QualityFilters>) => {
    setPage(0);
    setFilters((f) => ({ ...f, ...patch }));
  };

  const reset = () => {
    setPage(0);
    setFilters(emptyQualityFilters);
  };

  return {
    filters,
    update,
    reset,
    page,
    setPage,
    baseParams,
    rows: list.rows,
    loading: list.loading,
    error: list.error,
    refetch: () => {
      list.refetch();
      summary.refetch();
    },
    summary: summary.rows[0],
    summaryLoading: summary.loading,
    options: options.rows[0],
  };
}
