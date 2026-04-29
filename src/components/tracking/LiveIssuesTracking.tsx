import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Clock, Filter,
  Flame, Loader2, RefreshCw, TrendingUp, Users, X,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { format, parseISO } from "date-fns";
import { EduValidationBadge, type EduValidation } from "@/components/live-issues/EduValidationBadge";
import { useEduDescriptions } from "@/hooks/useEduDescriptions";
import { Target, Plus, Eye } from "lucide-react";
import { CreateActionPlanDialog } from "@/components/action-plans/CreateActionPlanDialog";
import { ActionPlanDetailDialog } from "@/components/action-plans/ActionPlanDetailDialog";
import type { ActionPlan, ActionPlanCategory } from "@/hooks/useActionPlans";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentTeamLeader } from "@/hooks/useCurrentTeamLeader";

interface IssueRow {
  id: string;
  case_id: string;
  session_date: string | null;
  from_tutor_id: string | null;
  from_tutor_name: string | null;
  team_leader: string | null;
  issue_reason: string | null;
  edu_validation: EduValidation;
  edu_description_id: string | null;
  month: string | null;
}

const ALL = "__all__";
const REPEATER_THRESHOLD = 3; // 3+ cases in the month = high-risk
const PENDING_BACKLOG_THRESHOLD = 0.4; // > 40% pending triggers warning
const PAGE_SIZE = 15;
const COLORS = {
  deduct: "hsl(0 84% 60%)",
  no_deduction: "hsl(142 71% 45%)",
  pending: "hsl(38 92% 50%)",
  none: "hsl(215 16% 47%)",
};

// Custom billing month: runs from the 26th of previous calendar month
// through the 25th of the labeled month.
// e.g. "April 2026" = 2026-03-26 .. 2026-04-25  -> key "2026-04"
function monthKey(d: string | null): string | null {
  if (!d) return null;
  // Parse YYYY-MM-DD safely without timezone shifts
  const [yStr, mStr, dayStr] = d.slice(0, 10).split("-");
  const y = Number(yStr);
  const m = Number(mStr); // 1-12
  const day = Number(dayStr);
  if (!y || !m || !day) return null;
  // Days 1..25 belong to current calendar month's billing window
  // Days 26..31 belong to NEXT calendar month's billing window
  let billY = y;
  let billM = m;
  if (day >= 26) {
    billM += 1;
    if (billM > 12) { billM = 1; billY += 1; }
  }
  return `${billY}-${String(billM).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  // key = "YYYY-MM" billing month label
  return format(parseISO(key + "-01"), "MMM yyyy");
}

export function LiveIssuesTracking() {
  const { items: descriptions } = useEduDescriptions(false);
  const descById = useMemo(
    () => Object.fromEntries(descriptions.map((d) => [d.id, d])),
    [descriptions],
  );

  const [allRows, setAllRows] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Filters
  const [month, setMonth] = useState<string>(ALL);
  const [tlFilter, setTlFilter] = useState<string>(ALL);
  const [validationFilter, setValidationFilter] = useState<string>(ALL);
  const [eduDescFilter, setEduDescFilter] = useState<string>(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tutorDrill, setTutorDrill] = useState<string | null>(null);

  // Sorting for TL breakdown
  const [tlSort, setTlSort] = useState<"pending_desc" | "progress_asc" | "total_desc">("pending_desc");
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch all rows for aggregation. Pull in pages to bypass 1000 row default limit.
    const PAGE = 1000;
    let from = 0;
    let combined: IssueRow[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("live_session_issues")
        .select("id, case_id, session_date, from_tutor_id, from_tutor_name, team_leader, issue_reason, edu_validation, edu_description_id, month")
        .order("session_date", { ascending: false, nullsFirst: false })
        .range(from, from + PAGE - 1);
      if (error) {
        console.error(error);
        break;
      }
      const batch = (data ?? []) as IssueRow[];
      combined = combined.concat(batch);
      if (batch.length < PAGE) break;
      from += PAGE;
      if (from > 50000) break; // safety
    }
    setAllRows(combined);
    setLastRefreshed(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => load(), 30000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  // Reset pagination when filters change
  useEffect(() => { setPage(0); }, [month, tlFilter, validationFilter, eduDescFilter, dateFrom, dateTo, tutorDrill]);

  // Distinct months
  const months = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => {
      const k = monthKey(r.session_date);
      if (k) set.add(k);
    });
    return Array.from(set).sort().reverse();
  }, [allRows]);

  // Distinct team leaders
  const teamLeaders = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.team_leader).filter(Boolean) as string[])).sort(),
    [allRows],
  );

  // Apply filters
  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      if (month !== ALL && monthKey(r.session_date) !== month) return false;
      if (tlFilter !== ALL && r.team_leader !== tlFilter) return false;
      if (tutorDrill && r.from_tutor_id !== tutorDrill) return false;
      if (validationFilter !== ALL) {
        if (validationFilter === "__none__" && r.edu_validation != null) return false;
        if (validationFilter !== "__none__" && r.edu_validation !== validationFilter) return false;
      }
      if (eduDescFilter !== ALL) {
        if (eduDescFilter === "__none__" && r.edu_description_id != null) return false;
        if (eduDescFilter !== "__none__" && r.edu_description_id !== eduDescFilter) return false;
      }
      if (dateFrom && r.session_date && r.session_date < dateFrom) return false;
      if (dateTo && r.session_date && r.session_date > dateTo) return false;
      return true;
    });
  }, [allRows, month, tlFilter, validationFilter, eduDescFilter, dateFrom, dateTo, tutorDrill]);

  // KPI numbers
  const kpis = useMemo(() => {
    const total = filtered.length;
    let deduct = 0, no_deduction = 0, pending = 0, none = 0;
    filtered.forEach((r) => {
      if (r.edu_validation === "deduct") deduct++;
      else if (r.edu_validation === "no_deduction") no_deduction++;
      else if (r.edu_validation === "pending") pending++;
      else none++;
    });
    const validated = deduct + no_deduction;
    const pendingTotal = pending + none;
    const progress = total ? Math.round((validated / total) * 100) : 0;
    return { total, validated, pending: pendingTotal, progress, deduct, no_deduction, pendingExplicit: pending, none };
  }, [filtered]);

  // TL breakdown
  const tlBreakdown = useMemo(() => {
    const map = new Map<string, { tl: string; total: number; validated: number; pending: number }>();
    filtered.forEach((r) => {
      const tl = r.team_leader || "—";
      if (!map.has(tl)) map.set(tl, { tl, total: 0, validated: 0, pending: 0 });
      const m = map.get(tl)!;
      m.total++;
      if (r.edu_validation === "deduct" || r.edu_validation === "no_deduction") m.validated++;
      else m.pending++;
    });
    const arr = Array.from(map.values()).map((m) => ({
      ...m,
      progress: m.total ? Math.round((m.validated / m.total) * 100) : 0,
    }));
    if (tlSort === "pending_desc") arr.sort((a, b) => b.pending - a.pending);
    else if (tlSort === "progress_asc") arr.sort((a, b) => a.progress - b.progress);
    else arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [filtered, tlSort]);

  // Repeaters this month (use selected month, or current month as fallback)
  const repeaters = useMemo(() => {
    const target = month !== ALL ? month : (months[0] ?? null);
    if (!target) return [];
    const monthRows = allRows.filter((r) => {
      if (monthKey(r.session_date) !== target) return false;
      if (tlFilter !== ALL && r.team_leader !== tlFilter) return false;
      return true;
    });
    const map = new Map<string, { tutor_id: string; tutor_name: string; team_leader: string; cases: number; reasons: Map<string, number> }>();
    monthRows.forEach((r) => {
      const tid = r.from_tutor_id || "—";
      if (!map.has(tid)) {
        map.set(tid, {
          tutor_id: tid,
          tutor_name: r.from_tutor_name || "—",
          team_leader: r.team_leader || "—",
          cases: 0,
          reasons: new Map(),
        });
      }
      const item = map.get(tid)!;
      item.cases++;
      const reason = r.issue_reason || "Unknown";
      item.reasons.set(reason, (item.reasons.get(reason) ?? 0) + 1);
    });
    return Array.from(map.values())
      .filter((x) => x.cases >= 2)
      .sort((a, b) => b.cases - a.cases)
      .slice(0, 25)
      .map((x) => ({
        ...x,
        topReason: Array.from(x.reasons.entries()).sort((a, b) => b[1] - a[1])[0],
      }));
  }, [allRows, month, months, tlFilter]);

  // Distribution chart data
  const distData = useMemo(() => [
    { name: "Deduct", value: kpis.deduct, color: COLORS.deduct },
    { name: "No Deduction", value: kpis.no_deduction, color: COLORS.no_deduction },
    { name: "Pending", value: kpis.pendingExplicit, color: COLORS.pending },
    { name: "Not Validated", value: kpis.none, color: COLORS.none },
  ].filter((d) => d.value > 0), [kpis]);

  // Issue reasons distribution
  const reasonData = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => {
      const k = r.issue_reason || "Unknown";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  // Edu Description distribution (categorize issues by validated edu description)
  const eduDescData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    let unset = 0;
    filtered.forEach((r) => {
      if (!r.edu_description_id) {
        unset++;
        return;
      }
      const d = descById[r.edu_description_id];
      const name = d?.name ?? "Unknown";
      const color = d?.color ?? "hsl(var(--muted-foreground))";
      const cur = map.get(r.edu_description_id);
      if (cur) cur.value++;
      else map.set(r.edu_description_id, { name, value: 1, color });
    });
    const arr = Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10);
    if (unset > 0) arr.push({ name: "Not categorized", value: unset, color: COLORS.none });
    return arr;
  }, [filtered, descById]);

  // Smart insights
  const insights = useMemo(() => {
    const out: { tone: "info" | "warn" | "success"; text: string }[] = [];
    if (kpis.total === 0) return out;
    const pendingPct = Math.round((kpis.pending / kpis.total) * 100);
    if (pendingPct > 0) {
      out.push({
        tone: pendingPct >= 40 ? "warn" : "info",
        text: `${pendingPct}% of cases (${kpis.pending}) are still pending validation.`,
      });
    }
    const worstTl = [...tlBreakdown].sort((a, b) => b.pending - a.pending)[0];
    if (worstTl && worstTl.pending > 0) {
      out.push({
        tone: "warn",
        text: `Team Leader ${worstTl.tl} has the highest pending backlog (${worstTl.pending} cases).`,
      });
    }
    const bestTl = [...tlBreakdown].filter((t) => t.total >= 3).sort((a, b) => b.progress - a.progress)[0];
    if (bestTl) {
      out.push({
        tone: "success",
        text: `Top performer: ${bestTl.tl} at ${bestTl.progress}% validation progress.`,
      });
    }
    if (repeaters.length > 0) {
      const top = repeaters.slice(0, 3).map((r) => `${r.tutor_name || r.tutor_id} (${r.cases})`).join(", ");
      out.push({
        tone: "info",
        text: `Top repeated tutors this month: ${top}.`,
      });
    }
    if (reasonData[0]) {
      const pct = Math.round((reasonData[0].value / kpis.total) * 100);
      out.push({
        tone: "info",
        text: `Majority of issues are "${reasonData[0].name}" (${pct}% of total).`,
      });
    }
    return out;
  }, [kpis, tlBreakdown, repeaters, reasonData]);

  // Alerts
  const alerts = useMemo(() => {
    const out: { tone: "warn" | "danger"; title: string; desc: string }[] = [];
    if (kpis.total > 0 && kpis.pending / kpis.total > PENDING_BACKLOG_THRESHOLD) {
      out.push({
        tone: "danger",
        title: "High backlog of validations",
        desc: `${kpis.pending} of ${kpis.total} cases still need validation (${Math.round((kpis.pending / kpis.total) * 100)}%).`,
      });
    }
    const highRisk = repeaters.filter((r) => r.cases >= REPEATER_THRESHOLD).length;
    if (highRisk > 0) {
      out.push({
        tone: "warn",
        title: "Increase in repeated issues this month",
        desc: `${highRisk} tutor(s) have ${REPEATER_THRESHOLD}+ cases in the selected month.`,
      });
    }
    return out;
  }, [kpis, repeaters]);

  // Detailed table rows (after filter, paginated)
  const sortedDetail = useMemo(
    () => [...filtered].sort((a, b) => (b.session_date ?? "").localeCompare(a.session_date ?? "")),
    [filtered],
  );
  const pageRows = sortedDetail.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(sortedDetail.length / PAGE_SIZE));

  const clearFilters = () => {
    setMonth(ALL); setTlFilter(ALL); setValidationFilter(ALL); setEduDescFilter(ALL);
    setDateFrom(""); setDateTo(""); setTutorDrill(null);
  };

  const hasFilters = month !== ALL || tlFilter !== ALL || validationFilter !== ALL ||
    eduDescFilter !== ALL || dateFrom || dateTo || tutorDrill;

  return (
    <div className="space-y-4">
      {/* Header / Live controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Live Session Issues — Tracking
          </h2>
          <p className="text-xs text-muted-foreground">
            Real-time validation progress and repeater detection
            {lastRefreshed && (
              <span className="ml-2">· Updated {format(lastRefreshed, "p")}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="live-toggle" />
            <Label htmlFor="live-toggle" className="cursor-pointer">Live (30s)</Label>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            <div>
              <Label className="text-xs flex items-center gap-1"><Filter className="h-3 w-3" /> Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All months</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {format(parseISO(m + "-01"), "MMM yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Team Leader</Label>
              <Select value={tlFilter} onValueChange={setTlFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {teamLeaders.map((tl) => <SelectItem key={tl} value={tl}>{tl}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Validation</Label>
              <Select value={validationFilter} onValueChange={setValidationFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="__none__">Not validated</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="deduct">Deduct</SelectItem>
                  <SelectItem value="no_deduction">No Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Edu Description</Label>
              <Select value={eduDescFilter} onValueChange={setEduDescFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="__none__">Not categorized</SelectItem>
                  {descriptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date from</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Date to</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full" onClick={clearFilters} disabled={!hasFilters}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            </div>
          </div>
          {tutorDrill && (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                Drill-down: tutor {tutorDrill}
                <button onClick={() => setTutorDrill(null)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.map((a, i) => (
        <Alert key={i} variant={a.tone === "danger" ? "destructive" : "default"}
          className={a.tone === "warn" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900" : ""}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{a.title}</AlertTitle>
          <AlertDescription>{a.desc}</AlertDescription>
        </Alert>
      ))}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Cases"
          value={kpis.total}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Validated"
          value={kpis.validated}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
        <KpiCard
          label="Pending"
          value={kpis.pending}
          icon={<Clock className="h-4 w-4" />}
          tone={kpis.total > 0 && kpis.pending / kpis.total > PENDING_BACKLOG_THRESHOLD ? "danger" : "warn"}
        />
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> Validation Progress
              </span>
              <span className={`text-xs font-semibold ${
                kpis.progress >= 70 ? "text-emerald-600" : kpis.progress >= 40 ? "text-amber-600" : "text-red-600"
              }`}>{kpis.progress}%</span>
            </div>
            <div className="text-2xl font-bold mt-1">{kpis.validated} / {kpis.total}</div>
            <Progress value={kpis.progress} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Validation Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {distData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {distData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <RTooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Issue Types</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {reasonData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reasonData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edu Description breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Issues by Edu Description</CardTitle>
          <p className="text-xs text-muted-foreground">
            Categorization of validated cases using the configured Edu Descriptions.
          </p>
        </CardHeader>
        <CardContent className="h-[300px]">
          {eduDescData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eduDescData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={180} tick={{ fontSize: 11 }} />
                <RTooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {eduDescData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Smart Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Smart Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {insights.map((ins, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-md border text-sm ${
                    ins.tone === "warn"
                      ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900"
                      : ins.tone === "success"
                      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900"
                      : "bg-muted/40"
                  }`}
                >
                  {ins.text}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TL Breakdown */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Team Leader Breakdown</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Sort by</Label>
            <Select value={tlSort} onValueChange={(v) => setTlSort(v as typeof tlSort)}>
              <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending_desc">Highest pending</SelectItem>
                <SelectItem value="progress_asc">Lowest performance</SelectItem>
                <SelectItem value="total_desc">Most cases</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {tlBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No data for current filters.</p>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Leader</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Validated</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="w-[200px]">Progress</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tlBreakdown.map((t) => (
                    <TableRow
                      key={t.tl}
                      className="cursor-pointer"
                      onClick={() => setTlFilter(t.tl === tlFilter ? ALL : t.tl)}
                    >
                      <TableCell className="font-medium">
                        {t.tl}
                        {tlFilter === t.tl && <Badge variant="secondary" className="ml-2 text-[10px]">Filtered</Badge>}
                      </TableCell>
                      <TableCell className="text-right">{t.total}</TableCell>
                      <TableCell className="text-right text-emerald-600 font-medium">{t.validated}</TableCell>
                      <TableCell className={`text-right font-medium ${t.pending > 0 ? "text-red-600" : ""}`}>{t.pending}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={t.progress} className="h-2 flex-1" />
                          <span className={`text-xs font-semibold w-10 text-right ${
                            t.progress >= 70 ? "text-emerald-600" : t.progress >= 40 ? "text-amber-600" : "text-red-600"
                          }`}>{t.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {t.progress >= 70 ? (
                          <ArrowUp className="h-4 w-4 text-emerald-600 inline" />
                        ) : (
                          <ArrowDown className="h-4 w-4 text-red-600 inline" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repeaters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            Repeaters This Month
            <Badge variant="outline" className="text-[10px]">
              {month !== ALL ? format(parseISO(month + "-01"), "MMM yyyy") : (months[0] ? format(parseISO(months[0] + "-01"), "MMM yyyy") : "—")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {repeaters.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No repeaters detected for this month.</p>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tutor</TableHead>
                    <TableHead>Tutor ID</TableHead>
                    <TableHead>Team Leader</TableHead>
                    <TableHead className="text-right">Cases</TableHead>
                    <TableHead>Top Issue</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repeaters.map((r) => {
                    const highRisk = r.cases >= REPEATER_THRESHOLD;
                    return (
                      <TableRow key={r.tutor_id} className={highRisk ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                        <TableCell className="font-medium text-sm">{r.tutor_name}</TableCell>
                        <TableCell className="font-mono text-xs">{r.tutor_id}</TableCell>
                        <TableCell className="text-xs">{r.team_leader}</TableCell>
                        <TableCell className="text-right font-semibold">{r.cases}</TableCell>
                        <TableCell className="text-xs">
                          {r.topReason ? `${r.topReason[0]} (×${r.topReason[1]})` : "—"}
                        </TableCell>
                        <TableCell>
                          {highRisk ? (
                            <Badge variant="destructive" className="text-[10px]">High Risk</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Watch</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setTutorDrill(r.tutor_id)}
                          >
                            View cases
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed live table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Cases ({sortedDetail.length})</CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <Button
              size="sm" variant="outline" className="h-7"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >Prev</Button>
            <span>Page {page + 1} / {totalPages}</span>
            <Button
              size="sm" variant="outline" className="h-7"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >Next</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Tutor ID</TableHead>
                  <TableHead>Team Leader</TableHead>
                  <TableHead>Issue Type</TableHead>
                  <TableHead>Edu Validation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-20 text-center">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell></TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                    No cases match the current filters.
                  </TableCell></TableRow>
                ) : pageRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs max-w-[160px] truncate" title={r.case_id}>{r.case_id}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {r.session_date ? format(new Date(r.session_date), "PP") : "—"}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{r.from_tutor_id || "—"}</TableCell>
                    <TableCell className="text-xs">{r.team_leader || "—"}</TableCell>
                    <TableCell className="text-xs">{r.issue_reason || "—"}</TableCell>
                    <TableCell><EduValidationBadge value={r.edu_validation} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label, value, icon, tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "success" | "warn" | "danger";
}) {
  const toneCls =
    tone === "success" ? "text-emerald-600" :
    tone === "warn" ? "text-amber-600" :
    tone === "danger" ? "text-red-600" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {icon}{label}
        </div>
        <div className={`text-2xl font-bold mt-1 ${toneCls}`}>{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      No data
    </div>
  );
}
