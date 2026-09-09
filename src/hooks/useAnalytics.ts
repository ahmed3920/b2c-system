import { useCallback, useEffect, useState } from "react";
import { runReplicaQuery } from "@/hooks/useReplicaQuery";

export type CompositionRow = {
  team_leader: string;
  total: number;
  tutors: number;
  mentors: number;
  full_time: number;
  part_time: number;
  tutors_full_time: number;
  tutors_part_time: number;
  mentors_full_time: number;
  mentors_part_time: number;
};

export type OccupationRow = {
  tutor_tid: string;
  name: string;
  team_leader: string;
  is_mentor: boolean;
  employment_type: number;
  tutor_status: number;
  working_days: number;
  target: number;
  delivered: number;
  occupation: string | number | null;
};

export type OccupationSummary = {
  people: number;
  delivered: number;
  target: number;
  avg_occupation: string | number | null;
  at_target: number;
  below_target: number;
};

const asParam = (v: string) => (v && v !== "" ? v : null);

export function useTeamComposition(status: string, teamLeader: string) {
  const [rows, setRows] = useState<CompositionRow[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        tutor_status: asParam(status) ? Number(status) : null,
        team_lead: asParam(teamLeader),
      };
      const [data, tls] = await Promise.all([
        runReplicaQuery<CompositionRow>("analytics_team_composition", params),
        runReplicaQuery<{ team_leader: string }>("analytics_team_leaders", {
          tutor_status: params.tutor_status,
          team_lead: null,
        }),
      ]);
      setRows(data);
      setTeamLeaders(tls.map((t) => t.team_leader));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, teamLeader]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, teamLeaders, loading, error, refetch: load };
}

export function useOccupation(opts: {
  status: string;
  teamLeader: string;
  dateFrom: string;
  dateTo: string;
  role: "all" | "tutor" | "mentor";
  search: string;
}) {
  const { status, teamLeader, dateFrom, dateTo, role, search } = opts;
  const [rows, setRows] = useState<OccupationRow[]>([]);
  const [summary, setSummary] = useState<OccupationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = {
        tutor_status: asParam(status) ? Number(status) : null,
        team_lead: asParam(teamLeader),
        date_from: asParam(dateFrom),
        date_to: asParam(dateTo),
        role: role === "all" ? null : role,
        search: asParam(search),
      };
      const [list, sum] = await Promise.all([
        runReplicaQuery<OccupationRow>("analytics_occupation_list", {
          ...base,
          limit: 1000,
          offset: 0,
        }),
        runReplicaQuery<OccupationSummary>("analytics_occupation_summary", base),
      ]);
      setRows(list);
      setSummary(sum[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [status, teamLeader, dateFrom, dateTo, role, search]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, summary, loading, error, refetch: load };
}
