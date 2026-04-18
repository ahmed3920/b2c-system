import { useEffect, useMemo, useState, useCallback } from "react";
import { format, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Award,
  ClipboardCheck,
  AlertTriangle,
  Trophy,
  CalendarIcon,
  X,
} from "lucide-react";

interface QualityRow {
  id: string;
  tutor_id: string | null;
  agent_name: string;
  team_leader: string;
  session_date: string | null;
  score: number;
}

interface AgentStat {
  tutor_id: string;
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
  const [selectedTutor, setSelectedTutor] = useState<AgentStat | null>(null);
  const [preset, setPreset] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const applyPreset = useCallback((p: string) => {
    setPreset(p);
    const today = new Date();
    switch (p) {
      case "all":
        setDateFrom(undefined);
        setDateTo(undefined);
        break;
      case "7d":
        setDateFrom(subDays(today, 6));
        setDateTo(today);
        break;
      case "30d":
        setDateFrom(subDays(today, 29));
        setDateTo(today);
        break;
      case "month":
        setDateFrom(startOfMonth(today));
        setDateTo(endOfMonth(today));
        break;
      case "last_month": {
        const lm = subMonths(today, 1);
        setDateFrom(startOfMonth(lm));
        setDateTo(endOfMonth(lm));
        break;
      }
      default:
        break;
    }
  }, []);

  const clearFilter = useCallback(() => applyPreset("all"), [applyPreset]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quality_uploads")
      .select("id, tutor_id, agent_name, team_leader, session_date, score")
      .order("created_at", { ascending: false });
    if (!error && data) setRows(data as QualityRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    if (!dateFrom && !dateTo) return rows;
    const fromTs = dateFrom ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate()).getTime() : -Infinity;
    const toTs = dateTo ? new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999).getTime() : Infinity;
    return rows.filter((r) => {
      if (!r.session_date) return false;
      const ts = new Date(r.session_date).getTime();
      return ts >= fromTs && ts <= toTs;
    });
  }, [rows, dateFrom, dateTo]);

  const stats = useMemo(() => {
    if (filteredRows.length === 0) return null;

    // Group by tutor_id (canonical) — fall back to agent_name if missing.
    const byTutor = new Map<
      string,
      { tutor_id: string; agent_name: string; team_leader: string; total: number; count: number }
    >();
    const byTL = new Map<string, { total: number; count: number }>();
    let total = 0;

    for (const r of filteredRows) {
      total += r.score;
      const key = (r.tutor_id ?? "").trim() || `name:${r.agent_name}`;
      const existing = byTutor.get(key);
      const a = existing ?? {
        tutor_id: r.tutor_id ?? "",
        agent_name: r.agent_name,
        team_leader: r.team_leader,
        total: 0,
        count: 0,
      };
      a.total += r.score;
      a.count += 1;
      // Use most recent name/team_leader (rows ordered desc by created_at)
      if (!existing) {
        a.agent_name = r.agent_name;
        a.team_leader = r.team_leader;
      }
      byTutor.set(key, a);

      const tl = byTL.get(r.team_leader) ?? { total: 0, count: 0 };
      tl.total += r.score;
      tl.count += 1;
      byTL.set(r.team_leader, tl);
    }

    const agentStats: AgentStat[] = Array.from(byTutor.values()).map((v) => ({
      tutor_id: v.tutor_id,
      agent_name: v.agent_name,
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
      overallAvg: total / filteredRows.length,
      totalEvaluations: filteredRows.length,
      highest: sortedDesc[0],
      lowest: sortedDesc[sortedDesc.length - 1],
      top,
      needsAction,
      agentStats: [...agentStats].sort((a, b) => a.agent_name.localeCompare(b.agent_name)),
      tlStats: tlStats.sort((a, b) => b.avg - a.avg),
    };
  }, [filteredRows]);

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
              label="Highest Tutor Score"
              value={`${stats.highest.avg.toFixed(1)}%`}
              hint={`${stats.highest.agent_name}${stats.highest.tutor_id ? ` (${stats.highest.tutor_id})` : ""}`}
              tone="success"
            />
            <SummaryCard
              icon={<TrendingDown className="w-5 h-5" />}
              label="Lowest Tutor Score"
              value={`${stats.lowest.avg.toFixed(1)}%`}
              hint={`${stats.lowest.agent_name}${stats.lowest.tutor_id ? ` (${stats.lowest.tutor_id})` : ""}`}
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
                    <TableHead>Tutor ID</TableHead>
                    <TableHead>Tutor Name</TableHead>
                    <TableHead className="text-right">Avg Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.top.map((a) => (
                    <TableRow key={a.tutor_id || a.agent_name}>
                      <TableCell className="font-mono text-xs">{a.tutor_id || "—"}</TableCell>
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
                      <TableHead>Tutor ID</TableHead>
                      <TableHead>Tutor Name</TableHead>
                      <TableHead className="text-right">Avg Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.needsAction.map((a) => (
                      <TableRow key={a.tutor_id || a.agent_name}>
                        <TableCell className="font-mono text-xs">{a.tutor_id || "—"}</TableCell>
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
            <h3 className="text-lg font-semibold mb-4">All Tutors</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tutor ID</TableHead>
                  <TableHead>Tutor Name</TableHead>
                  <TableHead>Team Leader</TableHead>
                  <TableHead className="text-right">Avg Score</TableHead>
                  <TableHead className="text-right"># Evaluations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.agentStats.map((a) => (
                  <TableRow
                    key={a.tutor_id || a.agent_name}
                    className="cursor-pointer"
                    onClick={() => setSelectedTutor(a)}
                  >
                    <TableCell className="font-mono text-xs">{a.tutor_id || "—"}</TableCell>
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

      <TutorHistoryDialog
        tutor={selectedTutor}
        rows={rows}
        onClose={() => setSelectedTutor(null)}
      />
    </div>
  );
};

const TutorHistoryDialog = ({
  tutor,
  rows,
  onClose,
}: {
  tutor: AgentStat | null;
  rows: QualityRow[];
  onClose: () => void;
}) => {
  const history = useMemo(() => {
    if (!tutor) return [];
    const matchById = (tutor.tutor_id ?? "").trim().length > 0;
    const filtered = rows.filter((r) =>
      matchById ? (r.tutor_id ?? "").trim() === tutor.tutor_id : r.agent_name === tutor.agent_name,
    );
    return filtered.sort((a, b) => {
      const ad = a.session_date ? new Date(a.session_date).getTime() : 0;
      const bd = b.session_date ? new Date(b.session_date).getTime() : 0;
      return bd - ad;
    });
  }, [tutor, rows]);

  const summary = useMemo(() => {
    if (history.length === 0) return null;
    const scores = history.map((h) => h.score);
    return {
      avg: scores.reduce((s, v) => s + v, 0) / scores.length,
      count: scores.length,
      high: Math.max(...scores),
      low: Math.min(...scores),
    };
  }, [history]);

  const scoreVariant = (s: number): "default" | "secondary" | "destructive" => {
    if (s >= 90) return "default";
    if (s >= 75) return "secondary";
    return "destructive";
  };

  return (
    <Dialog open={!!tutor} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        {tutor && (
          <>
            <DialogHeader>
              <DialogTitle>{tutor.agent_name}</DialogTitle>
              <DialogDescription>
                <span className="font-mono">{tutor.tutor_id || "No ID"}</span>
                {" • "}
                Team Leader: {tutor.team_leader}
              </DialogDescription>
            </DialogHeader>

            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                <MiniStat label="Average" value={`${summary.avg.toFixed(1)}%`} />
                <MiniStat label="Evaluations" value={summary.count.toString()} />
                <MiniStat label="Highest" value={`${summary.high.toFixed(1)}%`} />
                <MiniStat label="Lowest" value={`${summary.low.toFixed(1)}%`} />
              </div>
            )}

            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No evaluation history available.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Team Leader</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        {h.session_date ? format(new Date(h.session_date), "PP") : "—"}
                      </TableCell>
                      <TableCell>{h.team_leader}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={scoreVariant(h.score)}>{h.score.toFixed(1)}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-lg font-bold mt-0.5">{value}</p>
  </div>
);

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
