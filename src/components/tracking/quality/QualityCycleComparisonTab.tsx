import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Download, Loader2, X } from "lucide-react";
import { useReplicaQuery, runReplicaQuery } from "@/hooks/useReplicaQuery";
import { useQualityScope } from "@/hooks/useQualityScope";
import type { QualityFilterOptions } from "@/hooks/useQualityReviews";
import { Field, downloadCsv } from "./QualityFilterBar";
import { TUTOR_STATUS_OPTIONS, cycleLabel } from "@/lib/tutorStatus";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ALL = "all";
const MAX_CYCLES = 4;

type MatrixRow = { cycle: string; category: string; criterion: string | null; avg_score: string | null; evaluations: number };
type OverallRow = { cycle: string; reviews: number; tutors: number; avg_score: string | null; needs_coaching: number; needs_immediate_action: number; remarkable: number };

const delta = (a: number | null, b: number | null) => (a == null || b == null ? null : b - a);

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const rounded = Math.round(value * 100) / 100;
  return (
    <span className={cn("text-xs font-medium", rounded > 0 ? "text-emerald-600" : rounded < 0 ? "text-destructive" : "text-muted-foreground")}>
      {rounded > 0 ? "+" : ""}{rounded.toFixed(2)}
    </span>
  );
}

export function QualityCycleComparisonTab() {
  const scope = useQualityScope();
  const options = useReplicaQuery<QualityFilterOptions>("quality_filter_options", {
    team_lead: scope.lockedTeamLead,
    mentor: scope.lockedMentor,
  });
  const allCycles = options.rows[0]?.review_cycles ?? [];

  const [cycles, setCycles] = useState<string[]>([]);
  const [teamLead, setTeamLead] = useState("");
  const [tutor, setTutor] = useState("");
  const [tutorStatus, setTutorStatus] = useState("");
  const [exporting, setExporting] = useState(false);

  // Default to the latest cycles once options arrive
  useEffect(() => {
    if (cycles.length === 0 && allCycles.length) setCycles(allCycles.slice(-Math.min(3, allCycles.length)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCycles.length]);

  const filterParams = useMemo(
    () => ({
      team_lead: scope.loading ? "__loading__" : scope.lockedTeamLead || teamLead || null,
      tutor: tutor || null,
      tutor_status: tutorStatus === "" ? null : Number(tutorStatus),
      mentor: scope.lockedMentor,
    }),
    [teamLead, tutor, tutorStatus, scope.loading, scope.lockedTeamLead, scope.lockedMentor],
  );
  const matrixParams = useMemo(() => ({ cycles, ...filterParams }), [cycles, filterParams]);
  const trendParams = useMemo(() => ({ cycles: null, ...filterParams }), [filterParams]);

  const matrix = useReplicaQuery<MatrixRow>("quality_cycle_criteria_matrix", matrixParams, { enabled: cycles.length > 0 });
  const overall = useReplicaQuery<OverallRow>("quality_cycle_overall", trendParams);

  // Ordered selected cycles (in the same order as the options list)
  const ordered = allCycles.filter((c) => cycles.includes(c));

  // Build a row per (category, criterion) with a score per cycle
  const rows = useMemo(() => {
    const map = new Map<string, { category: string; criterion: string | null; scores: Record<string, number | null> }>();
    for (const r of matrix.rows) {
      const key = `${r.category}||${r.criterion ?? ""}`;
      if (!map.has(key)) map.set(key, { category: r.category, criterion: r.criterion, scores: {} });
      map.get(key)!.scores[r.cycle] = r.avg_score == null ? null : Number(r.avg_score);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.category === b.category
        ? (a.criterion ?? "").localeCompare(b.criterion ?? "")
        : a.category.localeCompare(b.category),
    );
  }, [matrix.rows]);

  const overallByCycle = useMemo(() => {
    const m: Record<string, OverallRow> = {};
    for (const r of overall.rows) m[r.cycle] = r;
    return m;
  }, [overall.rows]);

  const trendData = overall.rows.map((r) => ({ cycle: cycleLabel(r.cycle), score: r.avg_score == null ? null : Number(r.avg_score), reviews: r.reviews }));

  // Trend per main category across selected cycles
  const categoryTrend = useMemo(() => {
    const mains = rows.filter((r) => r.criterion == null);
    return ordered.map((c) => {
      const point: Record<string, string | number | null> = { cycle: cycleLabel(c) };
      for (const m of mains) point[m.category] = m.scores[c] ?? null;
      return point;
    });
  }, [rows, ordered]);
  const mainNames = rows.filter((r) => r.criterion == null).map((r) => r.category);
  const palette = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--chart-2, 38 92% 50%))", "hsl(var(--chart-3, 160 60% 40%))", "hsl(var(--chart-4, 280 60% 55%))", "hsl(var(--chart-5, 200 70% 45%))"];

  const toggleCycle = (c: string) => {
    setCycles((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c);
      if (prev.length >= MAX_CYCLES) {
        toast({ title: `Pick up to ${MAX_CYCLES} cycles` });
        return prev;
      }
      return [...prev, c];
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await runReplicaQuery<MatrixRow>("quality_cycle_criteria_matrix", matrixParams);
      const out = rows.map((r) => {
        const o: Record<string, unknown> = { category: r.category, criterion: r.criterion ?? "(overall)" };
        for (const c of ordered) o[`cycle_${c}`] = r.scores[c] ?? "";
        return o;
      });
      const overallRow: Record<string, unknown> = { category: "Overall review score", criterion: "" };
      for (const c of ordered) overallRow[`cycle_${c}`] = overallByCycle[c]?.avg_score ?? "";
      if (!data.length || !downloadCsv(`quality-cycle-comparison-${new Date().toISOString().slice(0, 10)}.csv`, [overallRow, ...out])) {
        toast({ title: "Nothing to export" });
      }
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Compare cycles</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setTeamLead(""); setTutor(""); setTutorStatus(""); setCycles(allCycles.slice(-3)); }}>
              <X className="w-3.5 h-3.5 mr-1.5" /> Reset
            </Button>
            <Button size="sm" onClick={handleExport} disabled={exporting || rows.length === 0}>
              {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Select 2–{MAX_CYCLES} cycles to place side by side</p>
            <div className="flex flex-wrap gap-2">
              {options.loading && allCycles.length === 0 && <span className="text-sm text-muted-foreground">Loading cycles…</span>}
              {allCycles.map((c) => {
                const on = cycles.includes(c);
                return (
                  <Button key={c} size="sm" variant={on ? "default" : "outline"} onClick={() => toggleCycle(c)}>
                    {cycleLabel(c)}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Team leader">
              <Select value={teamLead || ALL} onValueChange={(v) => setTeamLead(v === ALL ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL}>All team leaders</SelectItem>
                  {(options.rows[0]?.team_leaders ?? []).map((tl) => <SelectItem key={tl} value={tl}>{tl}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tutor name or T-ID">
              <Input placeholder="e.g. T-4602" value={tutor} onChange={(e) => setTutor(e.target.value)} />
            </Field>
            <Field label="Tutor status">
              <Select value={tutorStatus || ALL} onValueChange={(v) => setTutorStatus(v === ALL ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {TUTOR_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Overall per cycle */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ordered.map((c, i) => {
          const o = overallByCycle[c];
          const prev = i > 0 ? overallByCycle[ordered[i - 1]] : undefined;
          const d = delta(prev?.avg_score == null ? null : Number(prev.avg_score), o?.avg_score == null ? null : Number(o.avg_score));
          return (
            <Card key={c}>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{cycleLabel(c)}</p>
                <p className="text-2xl font-semibold flex items-baseline gap-2">
                  {o?.avg_score != null ? Number(o.avg_score).toFixed(2) : "—"}
                  {i > 0 && <Delta value={d} />}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {o ? `${o.reviews} reviews · ${o.tutors} tutors · ${o.needs_coaching} coaching` : "No reviews"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Overall score trend (all cycles)</CardTitle></CardHeader>
          <CardContent className="h-72">
            {overall.loading ? <p className="text-sm text-muted-foreground">Loading…</p> : overall.error ? (
              <p className="text-destructive text-sm">{overall.error}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="cycle" fontSize={11} />
                  <YAxis domain={[0, 5]} fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Main criteria across selected cycles</CardTitle></CardHeader>
          <CardContent className="h-72">
            {matrix.loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={categoryTrend} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="cycle" fontSize={11} />
                  <YAxis domain={[0, 5]} fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {mainNames.map((n, i) => (
                    <Line key={n} type="monotone" dataKey={n} stroke={palette[i % palette.length]} strokeWidth={2} dot connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Side-by-side scores by criterion</CardTitle></CardHeader>
        <CardContent>
          {matrix.error ? (
            <p className="text-destructive text-sm flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5" /> {matrix.error}</p>
          ) : cycles.length < 2 ? (
            <p className="text-sm text-muted-foreground">Select at least two cycles.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Criterion</TableHead>
                    {ordered.map((c) => <TableHead key={c} className="text-right">{cycleLabel(c)}</TableHead>)}
                    <TableHead className="text-right">Change (first → last)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell>Overall review score</TableCell>
                    {ordered.map((c) => <TableCell key={c} className="text-right">{overallByCycle[c]?.avg_score != null ? Number(overallByCycle[c].avg_score).toFixed(2) : "—"}</TableCell>)}
                    <TableCell className="text-right">
                      <Delta value={delta(
                        overallByCycle[ordered[0]]?.avg_score == null ? null : Number(overallByCycle[ordered[0]].avg_score),
                        overallByCycle[ordered[ordered.length - 1]]?.avg_score == null ? null : Number(overallByCycle[ordered[ordered.length - 1]].avg_score),
                      )} />
                    </TableCell>
                  </TableRow>
                  {matrix.loading && rows.length === 0 ? (
                    <TableRow><TableCell colSpan={ordered.length + 2} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                  ) : rows.map((r) => {
                    const first = r.scores[ordered[0]] ?? null;
                    const last = r.scores[ordered[ordered.length - 1]] ?? null;
                    const isMain = r.criterion == null;
                    return (
                      <TableRow key={`${r.category}-${r.criterion ?? ""}`} className={cn(isMain && "bg-muted/20")}>
                        <TableCell className={cn(isMain ? "font-medium" : "pl-8 text-sm text-muted-foreground")}>
                          {isMain ? r.category : r.criterion}
                          {isMain && <Badge variant="outline" className="ml-2">Main</Badge>}
                        </TableCell>
                        {ordered.map((c) => (
                          <TableCell key={c} className="text-right">{r.scores[c] != null ? r.scores[c]!.toFixed(2) : "—"}</TableCell>
                        ))}
                        <TableCell className="text-right"><Delta value={delta(first, last)} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
