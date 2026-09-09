import { useEffect, useMemo, useState } from "react";
import { useReplicaQuery } from "@/hooks/useReplicaQuery";
import { useQualityScope } from "@/hooks/useQualityScope";

export type CoverageState = "missing" | "reviewed" | "no_sessions";

export type CoverageRow = {
  tutor_tid: string | null;
  tutor_name: string | null;
  tutor_status: number | null;
  team_leader: string | null;
  mentor_name: string | null;
  organizations: string | null;
  sessions: number;
  student_sessions: number;
  reviews: number;
  coverage_state: CoverageState;
  cycle: string | null;
};

export type CoverageSummary = {
  total: number;
  reviewed: number;
  missing: number;
  no_sessions: number;
  cycle: string | null;
};

export type CoverageFilters = {
  cycle: string;
  team_lead: string;
  tutor: string;
  tutor_status: string;
  organization: string;
  coverage: CoverageState | "all";
};

export const emptyCoverageFilters: CoverageFilters = {
  cycle: "",
  team_lead: "",
  tutor: "",
  tutor_status: "0",
  organization: "",
  coverage: "missing",
};

export const COVERAGE_PAGE_SIZE = 100;

export const coverageStateLabel: Record<CoverageState, string> = {
  reviewed: "Reviewed",
  missing: "Missing review",
  no_sessions: "No sessions",
};

/** Tutors with / without a quality review for a given cycle. */
export function useQualityCoverage() {
  const scope = useQualityScope();
  const [filters, setFilters] = useState<CoverageFilters>(emptyCoverageFilters);
  const [page, setPage] = useState(0);

  const cycles = useReplicaQuery<{ cycle: string }>("quality_cycles_list", {});
  const latestCycle = cycles.rows[0]?.cycle ?? "";

  // Default to the newest cycle once the list arrives.
  useEffect(() => {
    if (!filters.cycle && latestCycle) setFilters((f) => ({ ...f, cycle: latestCycle }));
  }, [latestCycle, filters.cycle]);

  const baseParams = useMemo(() => {
    const p: Record<string, unknown> = {
      cycle: filters.cycle || latestCycle || null,
      team_lead: filters.team_lead || null,
      tutor: filters.tutor || null,
      tutor_status: filters.tutor_status === "" ? null : Number(filters.tutor_status),
      organization: filters.organization || null,
      mentor: null,
    };
    if (scope.loading) return { ...p, team_lead: "__loading__" };
    if (scope.lockedTeamLead) p.team_lead = scope.lockedTeamLead;
    if (scope.lockedMentor) p.mentor = scope.lockedMentor;
    return p;
  }, [filters, latestCycle, scope.loading, scope.lockedTeamLead, scope.lockedMentor]);

  const listParams = useMemo(
    () => ({
      ...baseParams,
      coverage: filters.coverage === "all" ? null : filters.coverage,
      limit: COVERAGE_PAGE_SIZE,
      offset: page * COVERAGE_PAGE_SIZE,
    }),
    [baseParams, filters.coverage, page],
  );

  const list = useReplicaQuery<CoverageRow>("quality_coverage_list", listParams);
  const summary = useReplicaQuery<CoverageSummary>("quality_coverage_summary", baseParams);

  const update = (patch: Partial<CoverageFilters>) => {
    setPage(0);
    setFilters((f) => ({ ...f, ...patch }));
  };
  const reset = () => {
    setPage(0);
    setFilters({ ...emptyCoverageFilters, cycle: latestCycle });
  };

  return {
    filters,
    update,
    reset,
    page,
    setPage,
    baseParams,
    cycles: cycles.rows.map((c) => c.cycle),
    rows: list.rows,
    loading: list.loading,
    error: list.error,
    summary: summary.rows[0],
    summaryLoading: summary.loading,
    scope,
    refetch: () => {
      list.refetch();
      summary.refetch();
    },
  };
}
