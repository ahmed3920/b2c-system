import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { motion } from "framer-motion";

type RawTask = { status: string; user_id: string; created_at: string };
type RawProfile = { user_id: string; mentor_name: string; team_leader: string };
type GroupRow = {
  name: string;
  total: number;
  monthTotal: number;
  inProgress: number;
  completed: number;
};

export const TaskBreakdownStats = () => {
  const { isAdmin, isTeamLeader } = useUserRole();
  const [rawTasks, setRawTasks] = useState<RawTask[]>([]);
  const [rawProfiles, setRawProfiles] = useState<RawProfile[]>([]);
  const [groupedStats, setGroupedStats] = useState<GroupRow[]>([]);
  const [groupBy, setGroupBy] = useState<"team_leader" | "mentor">("team_leader");
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

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
      let q = supabase.from("tasks").select("status, user_id, created_at");
      if (visibleIds.length > 0) q = q.in("user_id", visibleIds);
      else q = q.eq("user_id", session.user.id);
      const { data: tasks } = await q;
      setRawTasks((tasks as RawTask[]) || []);
    };
    load();
  }, [enabled]);

  useEffect(() => {
    if (rawProfiles.length === 0 && rawTasks.length === 0) {
      setGroupedStats([]);
      return;
    }
    const profileMap = new Map(rawProfiles.map((p) => [p.user_id, p]));
    const teamLeaderNames = new Set(
      rawProfiles.map((p) => p.team_leader).filter(Boolean)
    );
    const isTeamLeaderUser = (userId: string) => {
      const p = profileMap.get(userId);
      if (!p) return false;
      return teamLeaderNames.has(p.mentor_name);
    };
    const inSelectedMonth = (iso: string) => {
      if (!monthFilter || monthFilter === "all") return true;
      return iso?.startsWith(monthFilter);
    };

    const map = new Map<string, GroupRow>();
    rawTasks.forEach((t) => {
      const p = profileMap.get(t.user_id);
      if (!p) return;
      if (groupBy === "team_leader" && !isTeamLeaderUser(t.user_id)) return;
      if (groupBy === "mentor" && isTeamLeaderUser(t.user_id)) return;
      const groupName = p.mentor_name;
      if (!groupName) return;
      const cur = map.get(groupName) || {
        name: groupName,
        total: 0,
        monthTotal: 0,
        inProgress: 0,
        completed: 0,
      };
      cur.total += 1;
      if (inSelectedMonth(t.created_at)) cur.monthTotal += 1;
      if (t.status === "in_progress") cur.inProgress += 1;
      if (t.status === "done") cur.completed += 1;
      map.set(groupName, cur);
    });
    setGroupedStats(Array.from(map.values()).sort((a, b) => b.total - a.total));
  }, [groupBy, monthFilter, rawTasks, rawProfiles]);

  if (!enabled) return null;

  const agg = groupedStats.reduce(
    (acc, g) => {
      acc.total += g.total;
      acc.monthTotal += g.monthTotal;
      acc.inProgress += g.inProgress;
      acc.completed += g.completed;
      return acc;
    },
    { total: 0, monthTotal: 0, inProgress: 0, completed: 0 }
  );
  const monthLabel =
    monthFilter === "all"
      ? "All Months"
      : new Date(monthFilter + "-01").toLocaleString("default", {
          month: "short",
          year: "numeric",
        });

  // Build month options: all 12 months of current year + any month present in data
  const currentYear = new Date().getFullYear();
  const allMonths = new Set<string>();
  for (let m = 1; m <= 12; m++) {
    allMonths.add(`${currentYear}-${String(m).padStart(2, "0")}`);
  }
  rawTasks.forEach((t) => {
    if (t.created_at) allMonths.add(t.created_at.slice(0, 7));
  });
  const months = Array.from(allMonths).sort().reverse();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 space-y-4"
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card rounded-lg p-4 shadow border border-border">
          <p className="text-sm text-muted-foreground">
            Total Tasks ({groupBy === "team_leader" ? "Team Leaders" : "Mentors"})
          </p>
          <p className="text-2xl font-bold text-foreground">{agg.total}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow border border-border">
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
          <p className="text-2xl font-bold text-foreground">{agg.monthTotal}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow border border-border">
          <p className="text-sm text-muted-foreground">In Progress</p>
          <p className="text-2xl font-bold text-blue-600">{agg.inProgress}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow border border-border">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-green-600">{agg.completed}</p>
        </div>
        <div className="bg-card rounded-lg p-4 shadow border border-border">
          <p className="text-sm text-muted-foreground">Completion Rate</p>
          <p className="text-2xl font-bold text-primary">
            {agg.total > 0 ? Math.round((agg.completed / agg.total) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border flex-wrap gap-2">
          <h3 className="font-semibold text-foreground">
            Breakdown by {groupBy === "team_leader" ? "Team Leader" : "Mentor"}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-border bg-card text-foreground"
            >
              <option value="all">All Months</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {new Date(m + "-01").toLocaleString("default", {
                    month: "short",
                    year: "numeric",
                  })}
                </option>
              ))}
            </select>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setGroupBy("team_leader")}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  groupBy === "team_leader"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                Team Leader
              </button>
              <button
                onClick={() => setGroupBy("mentor")}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  groupBy === "mentor"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                Mentor
              </button>
            </div>
          </div>
        </div>
        {groupedStats.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">
            No data available.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    {groupBy === "team_leader" ? "Team Leader" : "Mentor"}
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                    Total
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                    {monthLabel}
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                    In Progress
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                    Completed
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedStats.map((g) => (
                  <tr
                    key={g.name}
                    className="border-t border-border hover:bg-muted/30"
                  >
                    <td className="px-4 py-2 text-foreground font-medium">
                      {g.name}
                    </td>
                    <td className="px-4 py-2 text-right text-foreground">
                      {g.total}
                    </td>
                    <td className="px-4 py-2 text-right text-foreground font-medium">
                      {g.monthTotal}
                    </td>
                    <td className="px-4 py-2 text-right text-blue-600">
                      {g.inProgress}
                    </td>
                    <td className="px-4 py-2 text-right text-green-600">
                      {g.completed}
                    </td>
                    <td className="px-4 py-2 text-right text-primary font-medium">
                      {g.total > 0
                        ? Math.round((g.completed / g.total) * 100)
                        : 0}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};
