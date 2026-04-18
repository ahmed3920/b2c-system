import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { QualityUpload } from "./QualityUpload";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Award, ClipboardCheck, AlertTriangle, Trophy } from "lucide-react";

interface QualityRow {
  id: string;
  agent_name: string;
  team_leader: string;
  session_date: string | null;
  score: number;
}

interface AgentStat {
  agent_name: string;
  team_leader: string;
  avg: number;
  count: number;
}

const ACTION_THRESHOLD = 90;

export const QualityTab = () => {
  const { isAdmin } = useUserRole();
  const [rows, setRows] = useState<QualityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quality_uploads")
      .select("id, agent_name, team_leader, session_date, score")
      .order("created_at", { ascending: false });
    if (!error && data) setRows(data as QualityRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    if (rows.length === 0) return null;

    const byAgent = new Map<string, { team_leader: string; total: number; count: number }>();
    const byTL = new Map<string, { total: number; count: number }>();
    let total = 0;

    for (const r of rows) {
      total += r.score;
      const a = byAgent.get(r.agent_name) ?? { team_leader: r.team_leader, total: 0, count: 0 };
      a.total += r.score;
      a.count += 1;
      a.team_leader = r.team_leader;
      byAgent.set(r.agent_name, a);

      const tl = byTL.get(r.team_leader) ?? { total: 0, count: 0 };
      tl.total += r.score;
      tl.count += 1;
      byTL.set(r.team_leader, tl);
    }

    const agentStats: AgentStat[] = Array.from(byAgent.entries()).map(([name, v]) => ({
      agent_name: name,
      team_leader: v.team_leader,
      avg: v.total / v.count,
      count: v.count,
    }));

    const tlStats = Array.from(byTL.entries()).map(([name, v]) => ({
      team_leader: name,
      avg: v.total / v.count,
      count: v.count,
    }));

    const sortedDesc = [...agentStats].sort((a, b) => b.avg - a.avg);
    const top = sortedDesc.slice(0, 5);
    const needsAction = agentStats.filter((a) => a.avg < ACTION_THRESHOLD).sort((a, b) => a.avg - b.avg);

    return {
      overallAvg: total / rows.length,
      totalEvaluations: rows.length,
      highest: sortedDesc[0],
      lowest: sortedDesc[sortedDesc.length - 1],
      top,
      needsAction,
      agentStats: [...agentStats].sort((a, b) => a.agent_name.localeCompare(b.agent_name)),
      tlStats: tlStats.sort((a, b) => b.avg - a.avg),
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <QualityUpload onUploaded={() => load()} />

      {!stats ? (
        <Card className="p-12 text-center">
          <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold">No quality data yet</h3>
          <p className="text-muted-foreground">Upload a sheet to see analytics.</p>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={<Award className="w-5 h-5" />}
              label="Overall Average"
              value={`${stats.overallAvg.toFixed(1)}%`}
              tone="primary"
            />
            <SummaryCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Highest Agent Score"
              value={`${stats.highest.avg.toFixed(1)}%`}
              hint={stats.highest.agent_name}
              tone="success"
            />
            <SummaryCard
              icon={<TrendingDown className="w-5 h-5" />}
              label="Lowest Agent Score"
              value={`${stats.lowest.avg.toFixed(1)}%`}
              hint={stats.lowest.agent_name}
              tone="warning"
            />
            <SummaryCard
              icon={<ClipboardCheck className="w-5 h-5" />}
              label="Total Evaluations"
              value={stats.totalEvaluations.toString()}
              tone="muted"
            />
          </div>

          {/* Top performers + Needs action */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-semibold">Top Performers</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent Name</TableHead>
                    <TableHead className="text-right">Avg Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.top.map((a) => (
                    <TableRow key={a.agent_name}>
                      <TableCell className="font-medium">{a.agent_name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{a.avg.toFixed(1)}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <h3 className="text-lg font-semibold">Needs Action Plan</h3>
                <span className="text-xs text-muted-foreground ml-auto">Avg &lt; {ACTION_THRESHOLD}%</span>
              </div>
              {stats.needsAction.length === 0 ? (
                <p className="text-sm text-muted-foreground">All agents are above {ACTION_THRESHOLD}%. 🎉</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent Name</TableHead>
                      <TableHead className="text-right">Avg Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.needsAction.map((a) => (
                      <TableRow key={a.agent_name}>
                        <TableCell className="font-medium">{a.agent_name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive">{a.avg.toFixed(1)}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>

          {/* Team Leader averages (admin only) */}
          {isAdmin && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Team Leader Averages</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Leader</TableHead>
                    <TableHead className="text-right">Avg Score</TableHead>
                    <TableHead className="text-right">Evaluations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.tlStats.map((t) => (
                    <TableRow key={t.team_leader}>
                      <TableCell className="font-medium">{t.team_leader}</TableCell>
                      <TableCell className="text-right">{t.avg.toFixed(1)}%</TableCell>
                      <TableCell className="text-right text-muted-foreground">{t.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Full data table */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">All Agents</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Name</TableHead>
                  <TableHead>Team Leader</TableHead>
                  <TableHead className="text-right">Avg Score</TableHead>
                  <TableHead className="text-right"># Evaluations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.agentStats.map((a) => (
                  <TableRow key={a.agent_name}>
                    <TableCell className="font-medium">{a.agent_name}</TableCell>
                    <TableCell>{a.team_leader}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={a.avg < ACTION_THRESHOLD ? "destructive" : "secondary"}>
                        {a.avg.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{a.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
};

const SummaryCard = ({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: "primary" | "success" | "warning" | "muted";
}) => {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-green-500/10 text-green-600 dark:text-green-400",
    warning: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${toneClass}`}>{icon}</div>
      </div>
    </Card>
  );
};
