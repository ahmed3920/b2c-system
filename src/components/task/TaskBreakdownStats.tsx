import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { motion } from "framer-motion";
import { formatDuration } from "@/components/task/TaskTimeRange";
import { ChevronDown, ChevronRight, Clock, ListChecks, Timer, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type RawTask = {
  status: string;
  user_id: string;
  created_at: string;
  duration_minutes: number | null;
  task_type: string | null;
};
type RawProfile = { user_id: string; mentor_name: string; team_leader: string };

type GroupRow = {
  name: string;
  userIds: string[];
  total: number;
  monthTotal: number;
  inProgress: number;
  completed: number;
  totalMinutes: number;       // sum duration of tasks in selected month
  totalMinutesAll: number;    // sum duration across all months
  completedMinutes: number;   // completed tasks duration (selected month)
  tasksWithDuration: number;  // # tasks in selected month with duration logged
  topType: string | null;
};

export type BreakdownGroupBy = "team_leader" | "mentor";

interface TaskBreakdownStatsProps {
  monthFilter?: string;
  onMonthFilterChange?: (value: string) => void;
  onScopeChange?: (scope: {
    groupBy: BreakdownGroupBy;
    monthFilter: string;
    userIds: string[];
  }) => void;
}

const fmtMins = (m: number) => (m > 0 ? formatDuration(m) : "—");

export const TaskBreakdownStats = ({
  monthFilter: controlledMonth,
  onMonthFilterChange,
  onScopeChange,
}: TaskBreakdownStatsProps) => {
  const { isAdmin, isTeamLeader } = useUserRole();
  const [rawTasks, setRawTasks] = useState<RawTask[]>([]);
  const [rawProfiles, setRawProfiles] = useState<RawProfile[]>([]);
  const [groupBy, setGroupBy] = useState<BreakdownGroupBy>("team_leader");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [internalMonth, setInternalMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const monthFilter = controlledMonth ?? internalMonth;
  const setMonthFilter = (v: string) => {
    if (onMonthFilterChange) onMonthFilterChange(v);
    else setInternalMonth(v);
  };

  const enabled = isAdmin || isTeamLeader;

  useEffect(() => {
    if (!enabled) return;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, mentor_name, team_leader");
      const visibleProfiles: RawProfile[] = profilesData || [];
      setRawProfiles(visibleProfiles);

      const visibleIds = visibleProfiles.map((p) => p.user_id);
      let q = supabase
        .from("tasks")
        .select("status, user_id, created_at, duration_minutes, task_type");
      if (visibleIds.length > 0) q = q.in("user_id", visibleIds);
      else q = q.eq("user_id", session.user.id);
      const { data: tasks } = await q.limit(5000);
      setRawTasks((tasks as RawTask[]) || []);
    };
    load();
  }, [enabled]);

  const profileMap = useMemo(
    () => new Map(rawProfiles.map((p) => [p.user_id, p])),
    [rawProfiles]
  );
  const teamLeaderNames = useMemo(
    () => new Set(rawProfiles.map((p) => p.team_leader).filter(Boolean)),
    [rawProfiles]
  );
  const isTeamLeaderUser = (userId: string) => {
    const p = profileMap.get(userId);
    if (!p) return false;
    return teamLeaderNames.has(p.mentor_name);
  };

  const inSelectedMonth = (iso: string) =>
    !monthFilter || monthFilter === "all" ? true : iso?.startsWith(monthFilter);

  // Notify parent of scope
  useEffect(() => {
    if (!onScopeChange) return;
    const userIds = rawProfiles
      .filter((p) =>
        groupBy === "team_leader" ? isTeamLeaderUser(p.user_id) : !isTeamLeaderUser(p.user_id)
      )
      .map((p) => p.user_id);
    onScopeChange({ groupBy, monthFilter, userIds });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, monthFilter, rawProfiles]);

  // Build grouped rows
  const groupedStats = useMemo<GroupRow[]>(() => {
    if (rawProfiles.length === 0 && rawTasks.length === 0) return [];

    const map = new Map<string, GroupRow & { typeCounts: Record<string, number> }>();
    const ensure = (name: string, userId: string) => {
      let cur = map.get(name);
      if (!cur) {
        cur = {
          name,
          userIds: [],
          total: 0,
          monthTotal: 0,
          inProgress: 0,
          completed: 0,
          totalMinutes: 0,
          totalMinutesAll: 0,
          completedMinutes: 0,
          tasksWithDuration: 0,
          topType: null,
          typeCounts: {},
        };
        map.set(name, cur);
      }
      if (!cur.userIds.includes(userId)) cur.userIds.push(userId);
      return cur;
    };

    rawTasks.forEach((t) => {
      const p = profileMap.get(t.user_id);
      if (!p) return;
      const isTL = isTeamLeaderUser(t.user_id);
      if (groupBy === "team_leader" && !isTL) return;
      if (groupBy === "mentor" && isTL) return;
      const groupName = p.mentor_name;
      if (!groupName) return;
      const cur = ensure(groupName, t.user_id);
      cur.total += 1;
      const inMonth = inSelectedMonth(t.created_at);
      if (inMonth) cur.monthTotal += 1;
      if (t.status === "in_progress") cur.inProgress += 1;
      if (t.status === "done") cur.completed += 1;
      const dur = t.duration_minutes || 0;
      cur.totalMinutesAll += dur;
      if (inMonth) {
        if (dur > 0) {
          cur.totalMinutes += dur;
          cur.tasksWithDuration += 1;
        }
        if (t.status === "done") cur.completedMinutes += dur;
        const tt = t.task_type || "Other";
        cur.typeCounts[tt] = (cur.typeCounts[tt] || 0) + 1;
      }
    });

    return Array.from(map.values())
      .map((g) => {
        const top = Object.entries(g.typeCounts).sort((a, b) => b[1] - a[1])[0];
        const { typeCounts, ...rest } = g;
        return { ...rest, topType: top ? `${top[0]} (${top[1]})` : null };
      })
      .sort((a, b) => b.monthTotal - a.monthTotal || b.total - a.total);
  }, [groupBy, monthFilter, rawTasks, rawProfiles, profileMap, teamLeaderNames]);

  // Drill-down: for a team leader, compute per-mentor breakdown
  const computeMentorChildren = (tlName: string): GroupRow[] => {
    const mentorProfiles = rawProfiles.filter(
      (p) => p.team_leader === tlName && !teamLeaderNames.has(p.mentor_name)
    );
    const byUser = new Map<string, GroupRow>();
    mentorProfiles.forEach((p) => {
      byUser.set(p.user_id, {
        name: p.mentor_name,
        userIds: [p.user_id],
        total: 0,
        monthTotal: 0,
        inProgress: 0,
        completed: 0,
        totalMinutes: 0,
        totalMinutesAll: 0,
        completedMinutes: 0,
        tasksWithDuration: 0,
        topType: null,
      });
    });
    const typeCounts: Record<string, Record<string, number>> = {};
    rawTasks.forEach((t) => {
      const row = byUser.get(t.user_id);
      if (!row) return;
      row.total += 1;
      const inMonth = inSelectedMonth(t.created_at);
      if (inMonth) row.monthTotal += 1;
      if (t.status === "in_progress") row.inProgress += 1;
      if (t.status === "done") row.completed += 1;
      const dur = t.duration_minutes || 0;
      row.totalMinutesAll += dur;
      if (inMonth) {
        if (dur > 0) {
          row.totalMinutes += dur;
          row.tasksWithDuration += 1;
        }
        if (t.status === "done") row.completedMinutes += dur;
        const tc = (typeCounts[row.name] = typeCounts[row.name] || {});
        const tt = t.task_type || "Other";
        tc[tt] = (tc[tt] || 0) + 1;
      }
    });
    return Array.from(byUser.values())
      .map((r) => {
        const tc = typeCounts[r.name] || {};
        const top = Object.entries(tc).sort((a, b) => b[1] - a[1])[0];
        return { ...r, topType: top ? `${top[0]} (${top[1]})` : null };
      })
      .sort((a, b) => b.monthTotal - a.monthTotal || b.total - a.total);
  };

  if (!enabled) return null;

  const agg = groupedStats.reduce(
    (acc, g) => {
      acc.total += g.total;
      acc.monthTotal += g.monthTotal;
      acc.inProgress += g.inProgress;
      acc.completed += g.completed;
      acc.totalMinutes += g.totalMinutes;
      acc.tasksWithDuration += g.tasksWithDuration;
      return acc;
    },
    { total: 0, monthTotal: 0, inProgress: 0, completed: 0, totalMinutes: 0, tasksWithDuration: 0 }
  );
  const avgMins = agg.tasksWithDuration > 0 ? Math.round(agg.totalMinutes / agg.tasksWithDuration) : 0;
  const monthLabel =
    monthFilter === "all"
      ? "All Months"
      : new Date(monthFilter + "-01").toLocaleString("default", { month: "short", year: "numeric" });

  const currentYear = new Date().getFullYear();
  const allMonths = new Set<string>();
  for (let m = 1; m <= 12; m++) {
    allMonths.add(`${currentYear}-${String(m).padStart(2, "0")}`);
  }
  rawTasks.forEach((t) => {
    if (t.created_at) allMonths.add(t.created_at.slice(0, 7));
  });
  const months = Array.from(allMonths).sort().reverse();

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const kpis = [
    { label: `Total Tasks (${groupBy === "team_leader" ? "Team Leaders" : "Mentors"})`, value: agg.total, icon: ListChecks, tone: "text-foreground" },
    { label: `${monthLabel} Tasks`, value: agg.monthTotal, icon: TrendingUp, tone: "text-foreground" },
    { label: "In Progress", value: agg.inProgress, icon: Users, tone: "text-blue-600" },
    { label: "Completed", value: agg.completed, icon: ListChecks, tone: "text-green-600" },
    { label: "Time Logged", value: fmtMins(agg.totalMinutes), icon: Clock, tone: "text-primary" },
    { label: "Avg / Task", value: fmtMins(avgMins), icon: Timer, tone: "text-primary" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 space-y-4"
    >
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card rounded-lg p-3 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
              <k.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </div>
            <p className={cn("text-xl font-bold leading-tight truncate", k.tone)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Breakdown table */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-foreground">
              {groupBy === "team_leader" ? "Team Leaders Analysis" : "Mentors Analysis"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Task volume, completion and time logged — {monthLabel}
              {groupBy === "team_leader" && " · click a row to view their team's mentors"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-border bg-card text-foreground"
            >
              <option value="all">All Months</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {new Date(m + "-01").toLocaleString("default", { month: "short", year: "numeric" })}
                </option>
              ))}
            </select>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => { setGroupBy("team_leader"); setExpanded(new Set()); }}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  groupBy === "team_leader"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                Team Leaders
              </button>
              <button
                onClick={() => { setGroupBy("mentor"); setExpanded(new Set()); }}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  groupBy === "mentor"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                Mentors
              </button>
            </div>
          </div>
        </div>

        {groupedStats.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No data available for this view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    {groupBy === "team_leader" ? "Team Leader" : "Mentor"}
                  </th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Total</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">{monthLabel}</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">In&nbsp;Progress</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Done</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Rate</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Time&nbsp;Logged</th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Avg/Task</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Top Task Type</th>
                </tr>
              </thead>
              <tbody>
                {groupedStats.map((g) => {
                  const rate = g.monthTotal > 0 ? Math.round((g.completed / g.total) * 100) : 0;
                  const avg = g.tasksWithDuration > 0 ? Math.round(g.totalMinutes / g.tasksWithDuration) : 0;
                  const isExpanded = expanded.has(g.name);
                  const canExpand = groupBy === "team_leader";
                  const children = isExpanded && canExpand ? computeMentorChildren(g.name) : [];
                  return (
                    <React.Fragment key={g.name}>
                      <tr
                        className={cn(
                          "border-t border-border hover:bg-muted/30 transition-colors",
                          canExpand && "cursor-pointer"
                        )}
                        onClick={() => canExpand && toggleExpand(g.name)}
                      >
                        <td className="px-4 py-2.5 text-foreground font-medium">
                          <div className="flex items-center gap-2">
                            {canExpand ? (
                              isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            ) : <span className="w-4" />}
                            {g.name}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-foreground">{g.total}</td>
                        <td className="px-3 py-2.5 text-right text-foreground font-medium">{g.monthTotal}</td>
                        <td className="px-3 py-2.5 text-right text-blue-600">{g.inProgress}</td>
                        <td className="px-3 py-2.5 text-right text-green-600">{g.completed}</td>
                        <td className="px-3 py-2.5 text-right text-primary font-medium">{rate}%</td>
                        <td className="px-3 py-2.5 text-right text-foreground tabular-nums">{fmtMins(g.totalMinutes)}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">{fmtMins(avg)}</td>
                        <td className="px-3 py-2.5 text-left text-muted-foreground text-xs">{g.topType || "—"}</td>
                      </tr>
                      {isExpanded && canExpand && (
                        <tr className="bg-muted/20">
                          <td colSpan={9} className="px-4 py-3">
                            {children.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No mentors found under this team leader.</p>
                            ) : (
                              <div className="overflow-x-auto rounded border border-border bg-card">
                                <table className="w-full text-xs">
                                  <thead className="bg-muted/40 text-muted-foreground">
                                    <tr>
                                      <th className="text-left px-3 py-2 font-medium">Mentor</th>
                                      <th className="text-right px-3 py-2 font-medium">Total</th>
                                      <th className="text-right px-3 py-2 font-medium">{monthLabel}</th>
                                      <th className="text-right px-3 py-2 font-medium">In&nbsp;Progress</th>
                                      <th className="text-right px-3 py-2 font-medium">Done</th>
                                      <th className="text-right px-3 py-2 font-medium">Rate</th>
                                      <th className="text-right px-3 py-2 font-medium">Time&nbsp;Logged</th>
                                      <th className="text-right px-3 py-2 font-medium">Avg/Task</th>
                                      <th className="text-left px-3 py-2 font-medium">Top Task Type</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {children.map((c) => {
                                      const cRate = c.monthTotal > 0 ? Math.round((c.completed / c.total) * 100) : 0;
                                      const cAvg = c.tasksWithDuration > 0 ? Math.round(c.totalMinutes / c.tasksWithDuration) : 0;
                                      return (
                                        <tr key={c.name} className="border-t border-border">
                                          <td className="px-3 py-2 text-foreground font-medium">{c.name}</td>
                                          <td className="px-3 py-2 text-right">{c.total}</td>
                                          <td className="px-3 py-2 text-right font-medium">{c.monthTotal}</td>
                                          <td className="px-3 py-2 text-right text-blue-600">{c.inProgress}</td>
                                          <td className="px-3 py-2 text-right text-green-600">{c.completed}</td>
                                          <td className="px-3 py-2 text-right text-primary font-medium">{cRate}%</td>
                                          <td className="px-3 py-2 text-right tabular-nums">{fmtMins(c.totalMinutes)}</td>
                                          <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtMins(cAvg)}</td>
                                          <td className="px-3 py-2 text-left text-muted-foreground">{c.topType || "—"}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};
