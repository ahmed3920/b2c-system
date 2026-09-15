import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileDown, Loader2, RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SearchableSelect } from "@/components/tracking/quality/QualityFilterBar";
import { downloadCsv } from "@/lib/exportCsv";
import { useCsTicketAnalytics, type CsAnalyticsTicket } from "@/hooks/useCsTicketAnalytics";
import { exportCsTicketsToPdf } from "@/utils/exportCsTicketsToPdf";
import { toast } from "@/hooks/use-toast";

const STATUSES = ["Valid", "Not Valid", "Not a Complain", "Pending"] as const;

/** Hide zero values so stacked bar labels stay readable. */
const hideZero = (v: number | string) => (Number(v) > 0 ? String(v) : "");
type Status = (typeof STATUSES)[number];

const STATUS_COLORS: Record<Status, string> = {
  Valid: "hsl(var(--primary))",
  "Not Valid": "hsl(var(--muted-foreground))",
  "Not a Complain": "hsl(var(--accent))",
  Pending: "hsl(var(--destructive))",
};

const normStatus = (s: string | null): Status => {
  if (s === "Validated") return "Valid";
  if (s === "Rejected") return "Not Valid";
  return (STATUSES as readonly string[]).includes(s ?? "") ? (s as Status) : "Pending";
};

const ticketDay = (t: CsAnalyticsTicket) => (t.ticket_date || t.created_at || "").slice(0, 10);

const isoDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const startOfMonth = () => new Date().toISOString().slice(0, 8) + "01";

const weekKey = (day: string) => {
  const d = new Date(day + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Monday start
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
};

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);

const categoryOf = (t: CsAnalyticsTicket) => t.cs_category || t.edu_category || t.category || "Uncategorised";

export function CsTicketsAnalyticsTab() {
  const { tickets, loading, error, refresh } = useCsTicketAnalytics();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [teamLeader, setTeamLeader] = useState("");
  const [caseType, setCaseType] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [tutor, setTutor] = useState("");
  const [grain, setGrain] = useState<"day" | "week">("day");
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const teamLeaders = useMemo(
    () => Array.from(new Set(tickets.map((t) => (t.team_leader || "").trim()).filter(Boolean))).sort(),
    [tickets],
  );
  const categories = useMemo(
    () => Array.from(new Set(tickets.map(categoryOf).filter(Boolean))).sort(),
    [tickets],
  );

  const rows = useMemo(() => {
    const q = tutor.trim().toLowerCase();
    return tickets.filter((t) => {
      const day = ticketDay(t);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (teamLeader && (t.team_leader || "").trim() !== teamLeader) return false;
      if (caseType) {
        const types = t.case_types?.length ? t.case_types : [t.case_type || ""];
        if (!types.includes(caseType)) return false;
      }
      if (status && normStatus(t.status) !== status) return false;
      if (category && categoryOf(t) !== category) return false;
      if (q && !`${t.tutor_name || ""} ${t.tutor_external_id || ""} ${t.ticket_number || ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [tickets, from, to, teamLeader, caseType, status, category, tutor]);

  const kpis = useMemo(() => {
    const counts: Record<Status, number> = { Valid: 0, "Not Valid": 0, "Not a Complain": 0, Pending: 0 };
    let overdue = 0;
    let closedDaysSum = 0;
    let closedCount = 0;
    const now = Date.now();
    for (const t of rows) {
      counts[normStatus(t.status)]++;
      if (normStatus(t.status) === "Pending" && t.need_response_deadline && new Date(t.need_response_deadline).getTime() < now)
        overdue++;
      if (t.closed_at && t.created_at) {
        closedDaysSum += (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 86400000;
        closedCount++;
      }
    }
    const decided = counts.Valid + counts["Not Valid"] + counts["Not a Complain"];
    return {
      total: rows.length,
      counts,
      overdue,
      validityRate: pct(counts.Valid, decided),
      avgClosingDays: closedCount ? Math.round((closedDaysSum / closedCount) * 10) / 10 : null,
    };
  }, [rows]);

  const trend = useMemo(() => {
    const map = new Map<string, { period: string; total: number; valid: number }>();
    for (const t of rows) {
      const day = ticketDay(t);
      if (!day) continue;
      const key = grain === "day" ? day : weekKey(day);
      const cur = map.get(key) ?? { period: key, total: 0, valid: 0 };
      cur.total++;
      if (normStatus(t.status) === "Valid") cur.valid++;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [rows, grain]);

  const statusSplit = useMemo(
    () => STATUSES.map((s) => ({ name: s, value: kpis.counts[s] })).filter((d) => d.value > 0),
    [kpis],
  );

  const caseTypeSplit = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of rows) {
      const types = t.case_types?.length ? t.case_types : [t.case_type || "Unknown"];
      for (const ty of types) map.set(ty || "Unknown", (map.get(ty || "Unknown") ?? 0) + 1);
    }
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const byTeamLeader = useMemo(() => {
    const map = new Map<string, { team_leader: string; total: number; closedDays: number; closedCount: number } & Record<Status, number>>();
    for (const t of rows) {
      const tl = (t.team_leader || "Unassigned").trim() || "Unassigned";
      const cur =
        map.get(tl) ??
        ({ team_leader: tl, total: 0, Valid: 0, "Not Valid": 0, "Not a Complain": 0, Pending: 0, closedDays: 0, closedCount: 0 } as any);
      cur.total++;
      cur[normStatus(t.status)]++;
      if (t.closed_at && t.created_at) {
        cur.closedDays += (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 86400000;
        cur.closedCount++;
      }
      map.set(tl, cur);
    }
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        validityPct: pct(r.Valid, r.Valid + r["Not Valid"] + r["Not a Complain"]),
        avgClosing: r.closedCount ? Math.round((r.closedDays / r.closedCount) * 10) / 10 : null,
      }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const topCategories = useMemo(() => {
    const map = new Map<string, { name: string; cs: number; edu: number; total: number }>();
    for (const t of rows) {
      const name = categoryOf(t);
      const cur = map.get(name) ?? { name, cs: 0, edu: 0, total: 0 };
      if (t.edu_category && !t.cs_category) cur.edu++;
      else cur.cs++;
      cur.total++;
      map.set(name, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 12);
  }, [rows]);

  const byTutor = useMemo(() => {
    const map = new Map<string, { key: string; tutor: string; total: number; valid: number; cats: Set<string> }>();
    for (const t of rows) {
      const key = t.tutor_external_id || t.tutor_name || "Unknown";
      const cur = map.get(key) ?? { key, tutor: `${t.tutor_name || "Unknown"}${t.tutor_external_id ? ` (${t.tutor_external_id})` : ""}`, total: 0, valid: 0, cats: new Set<string>() };
      cur.total++;
      if (normStatus(t.status) === "Valid") cur.valid++;
      cur.cats.add(categoryOf(t));
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const topTutorsValid = useMemo(
    () => [...byTutor].sort((a, b) => b.valid - a.valid).slice(0, 15),
    [byTutor],
  );

  const byMentor = useMemo(() => {
    const map = new Map<string, { mentor: string; total: number; valid: number; notValid: number; pending: number }>();
    for (const t of rows) {
      if (!t.assigned_mentor_name) continue;
      const cur = map.get(t.assigned_mentor_name) ?? { mentor: t.assigned_mentor_name, total: 0, valid: 0, notValid: 0, pending: 0 };
      cur.total++;
      const v = (t.mentor_validation || "").toLowerCase();
      if (v.includes("not")) cur.notValid++;
      else if (v) cur.valid++;
      else cur.pending++;
      map.set(t.assigned_mentor_name, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 15);
  }, [rows]);

  const preset = (p: string) => {
    if (p === "7") { setFrom(isoDaysAgo(7)); setTo(""); }
    else if (p === "30") { setFrom(isoDaysAgo(30)); setTo(""); }
    else if (p === "month") { setFrom(startOfMonth()); setTo(""); }
    else { setFrom(""); setTo(""); }
  };

  const handleExportPdf = async () => {
    if (!containerRef.current) return;
    setExporting(true);
    try {
      const rangeLabel = from || to ? `${from || "start"}_${to || "today"}` : "all-time";
      await exportCsTicketsToPdf(containerRef.current, {
        fileName: `cs-tickets-analysis_${rangeLabel}.pdf`,
        showing: `Showing ${rows.length} of ${tickets.length} tickets`,
        filters: [
          { label: "From", value: from || "Earliest" },
          { label: "To", value: to || "Today" },
          { label: "Team leader", value: teamLeader || "All" },
          { label: "Case type", value: caseType || "All" },
          { label: "Status", value: status || "All" },
          { label: "Category", value: category || "All" },
          { label: "Tutor / ticket", value: tutor || "All" },
        ],
        kpis: [
          { label: "Total tickets", value: String(kpis.total) },
          { label: "Valid", value: String(kpis.counts.Valid), sub: `${pct(kpis.counts.Valid, kpis.total)}%` },
          { label: "Not Valid", value: String(kpis.counts["Not Valid"]), sub: `${pct(kpis.counts["Not Valid"], kpis.total)}%` },
          { label: "Not a Complain", value: String(kpis.counts["Not a Complain"]), sub: `${pct(kpis.counts["Not a Complain"], kpis.total)}%` },
          { label: "Pending", value: String(kpis.counts.Pending), sub: `${kpis.overdue} past deadline` },
          { label: "Validity rate", value: `${kpis.validityRate}%`, sub: "of decided" },
          { label: "Avg. closing", value: kpis.avgClosingDays === null ? "—" : `${kpis.avgClosingDays}d`, sub: "creation to close" },
        ],
        tables: [
          {
            title: "Team leader summary",
            head: ["Team leader", "Total", "Valid", "Not Valid", "Not a Complain", "Pending", "Validity %", "Avg closing (days)"],
            body: byTeamLeader.map((r) => [r.team_leader, r.total, r.Valid, r["Not Valid"], r["Not a Complain"], r.Pending, `${r.validityPct}%`, r.avgClosing ?? "—"]),
          },
          {
            title: "Tutor summary (top 50)",
            head: ["Tutor", "Total", "Valid", "Categories"],
            body: byTutor.slice(0, 50).map((r) => [r.tutor, r.total, r.valid, r.cats.size]),
          },
        ],
      });
    } catch (e) {
      toast({
        title: "Could not create the PDF",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4" ref={containerRef}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Quick range</Label>
            <Select onValueChange={preset}>
              <SelectTrigger><SelectValue placeholder="Choose a range" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Team leader</Label>
            <SearchableSelect value={teamLeader} onChange={setTeamLeader} options={teamLeaders} allLabel="All team leaders" />
          </div>
          <div className="space-y-1">
            <Label>Case type</Label>
            <Select value={caseType || "all"} onValueChange={(v) => setCaseType(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All case types</SelectItem>
                <SelectItem value="CS">CS</SelectItem>
                <SelectItem value="Edu">Edu</SelectItem>
                <SelectItem value="System">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <SearchableSelect value={category} onChange={setCategory} options={categories} allLabel="All categories" />
          </div>
          <div className="space-y-1">
            <Label>Tutor / ticket</Label>
            <Input placeholder="Name, T-ID or ticket #" value={tutor} onChange={(e) => setTutor(e.target.value)} />
          </div>
          <div className="flex items-end gap-2 md:col-span-4">
            <Button variant="outline" onClick={refresh} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setFrom(""); setTo(""); setTeamLeader(""); setCaseType(""); setStatus(""); setCategory(""); setTutor(""); }}
            >
              Clear filters
            </Button>
            <Button onClick={handleExportPdf} disabled={exporting || loading || rows.length === 0}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              <span className="ml-2">{exporting ? "Preparing PDF…" : "Export PDF"}</span>
            </Button>
            <span className="text-sm text-muted-foreground ml-auto">
              Showing {rows.length} of {tickets.length} tickets
            </span>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-7">
        {[
          { label: "Total tickets", value: kpis.total, sub: "" },
          { label: "Valid", value: kpis.counts.Valid, sub: `${pct(kpis.counts.Valid, kpis.total)}%` },
          { label: "Not Valid", value: kpis.counts["Not Valid"], sub: `${pct(kpis.counts["Not Valid"], kpis.total)}%` },
          { label: "Not a Complain", value: kpis.counts["Not a Complain"], sub: `${pct(kpis.counts["Not a Complain"], kpis.total)}%` },
          { label: "Pending", value: kpis.counts.Pending, sub: `${kpis.overdue} past deadline` },
          { label: "Validity rate", value: `${kpis.validityRate}%`, sub: "of decided tickets" },
          { label: "Avg. closing time", value: kpis.avgClosingDays === null ? "—" : `${kpis.avgClosingDays}d`, sub: "creation to close" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-2xl font-semibold">{k.value}</p>
              {k.sub && <p className="text-xs text-muted-foreground">{k.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Tickets over time</CardTitle>
            <Select value={grain} onValueChange={(v) => setGrain(v as "day" | "week")}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="h-72" data-chart="Tickets over time">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" name="All tickets" stroke="hsl(var(--primary))" dot={false} />
                <Line type="monotone" dataKey="valid" name="Valid" stroke="hsl(var(--destructive))" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Status split</CardTitle></CardHeader>
          <CardContent className="h-72" data-chart="Status split">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusSplit} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} label>
                  {statusSplit.map((d) => <Cell key={d.name} fill={STATUS_COLORS[d.name as Status]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Tickets by team leader</CardTitle></CardHeader>
          <CardContent className="h-80" data-chart="Tickets by team leader">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byTeamLeader}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="team_leader" tick={{ fontSize: 11 }} interval={0} angle={-12} height={60} textAnchor="end" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {STATUSES.map((s, i) => (
                  <Bar key={s} dataKey={s} name={s} stackId="a" fill={STATUS_COLORS[s]}>
                    {i === STATUSES.length - 1 && (
                      <LabelList dataKey="total" position="top" fontSize={10} formatter={hideZero} />
                    )}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Case type</CardTitle></CardHeader>
          <CardContent className="h-80" data-chart="Case type">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={caseTypeSplit}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Tickets" fill="hsl(var(--primary))">
                  <LabelList dataKey="value" position="top" fontSize={11} formatter={hideZero} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Top categories</CardTitle></CardHeader>
        <CardContent className="h-[520px]" data-chart="Top categories">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topCategories} layout="vertical" margin={{ left: 140, right: 32 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} interval={0} />
              <Tooltip />
              <Legend />
              <Bar dataKey="cs" name="CS" stackId="c" fill="hsl(var(--primary))" />
              <Bar dataKey="edu" name="Edu" stackId="c" fill="hsl(var(--muted-foreground))">
                <LabelList dataKey="total" position="right" fontSize={10} formatter={hideZero} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top 15 tutors by tickets</CardTitle></CardHeader>
          <CardContent className="h-[560px]" data-chart="Top 15 tutors by tickets">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byTutor.slice(0, 15)} layout="vertical" margin={{ left: 120, right: 28 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="tutor" width={180} tick={{ fontSize: 10 }} interval={0} />
                <Tooltip />
                <Bar dataKey="total" name="Tickets" fill="hsl(var(--primary))">
                  <LabelList dataKey="total" position="right" fontSize={10} formatter={hideZero} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top 15 tutors by valid tickets</CardTitle></CardHeader>
          <CardContent className="h-[420px]" data-chart="Top 15 tutors by valid tickets">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTutorsValid} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="tutor" width={180} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="valid" name="Valid tickets" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {byMentor.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Mentor evaluation workload</CardTitle></CardHeader>
          <CardContent className="h-80" data-chart="Mentor evaluation workload">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMentor}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mentor" tick={{ fontSize: 10 }} interval={0} angle={-15} height={70} textAnchor="end" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="valid" name="Validated" stackId="m" fill="hsl(var(--primary))" />
                <Bar dataKey="notValid" name="Not valid" stackId="m" fill="hsl(var(--muted-foreground))" />
                <Bar dataKey="pending" name="No evaluation yet" stackId="m" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Team leader summary</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                "cs-tickets-by-team-leader",
                ["Team leader", "Total", "Valid", "Not Valid", "Not a Complain", "Pending", "Validity %", "Avg closing days"],
                byTeamLeader.map((r) => [r.team_leader, r.total, r.Valid, r["Not Valid"], r["Not a Complain"], r.Pending, r.validityPct, r.avgClosing ?? ""]),
              )
            }
          >
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team leader</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Valid</TableHead>
                <TableHead className="text-right">Not Valid</TableHead>
                <TableHead className="text-right">Not a Complain</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Validity %</TableHead>
                <TableHead className="text-right">Avg closing (days)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !rows.length ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : byTeamLeader.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No tickets match these filters</TableCell></TableRow>
              ) : (
                byTeamLeader.map((r) => (
                  <TableRow key={r.team_leader}>
                    <TableCell className="font-medium">{r.team_leader}</TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right">{r.Valid}</TableCell>
                    <TableCell className="text-right">{r["Not Valid"]}</TableCell>
                    <TableCell className="text-right">{r["Not a Complain"]}</TableCell>
                    <TableCell className="text-right">{r.Pending}</TableCell>
                    <TableCell className="text-right">{r.validityPct}%</TableCell>
                    <TableCell className="text-right">{r.avgClosing ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Tutor summary (top 50)</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                "cs-tickets-by-tutor",
                ["Tutor", "Total tickets", "Valid", "Categories"],
                byTutor.map((r) => [r.tutor, r.total, r.valid, Array.from(r.cats).join(" | ")]),
              )
            }
          >
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tutor</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Valid</TableHead>
                <TableHead className="text-right">Categories</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byTutor.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No tickets match these filters</TableCell></TableRow>
              ) : (
                byTutor.slice(0, 50).map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.tutor}</TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right">{r.valid}</TableCell>
                    <TableCell className="text-right">{r.cats.size}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
