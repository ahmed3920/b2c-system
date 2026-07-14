import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Loader2, History, Download } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useTutorSegmentation, type SegmentationScore, type TutorSegment } from "@/hooks/useTutorSegmentation";
import { SegmentBadge, TrendIndicator } from "@/components/segmentation/SegmentBadge";
import { TutorProfileDialog } from "@/components/segmentation/TutorProfileDialog";
import { AuditLogDialog } from "@/components/segmentation/AuditLogDialog";
import { ExportDialog } from "@/components/segmentation/ExportDialog";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { toast } from "sonner";

const SEGMENT_COLORS: Record<TutorSegment, string> = {
  elite: "#10b981",
  growth: "#3b82f6",
  at_risk: "#f97316",
};

export default function TutorSegmentation() {
  const { isAdmin } = useUserRole();
  const { scores, recommendations, loading, running, recompute } = useTutorSegmentation();
  const [search, setSearch] = useState("");
  const [tlFilter, setTlFilter] = useState<string>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [segFilter, setSegFilter] = useState<string>("all");
  const [selected, setSelected] = useState<SegmentationScore | null>(null);
  const [sortKey, setSortKey] = useState<keyof SegmentationScore>("health_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [auditOpen, setAuditOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const teamLeaders = useMemo(
    () => Array.from(new Set(scores.map((s) => s.team_leader).filter(Boolean))) as string[],
    [scores]
  );
  const languages = useMemo(
    () => Array.from(new Set(scores.map((s) => s.language).filter(Boolean))) as string[],
    [scores]
  );

  const filtered = useMemo(() => {
    let rows = scores;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((s) => s.tutor_name.toLowerCase().includes(q) || s.tutor_external_id.toLowerCase().includes(q));
    }
    if (tlFilter !== "all") rows = rows.filter((s) => s.team_leader === tlFilter);
    if (langFilter !== "all") rows = rows.filter((s) => s.language === langFilter);
    if (segFilter !== "all") rows = rows.filter((s) => s.segment === segFilter);
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] as any, bv = b[sortKey] as any;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortDir === "desc" ? bv - av : av - bv;
      return sortDir === "desc" ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
    return rows;
  }, [scores, search, tlFilter, langFilter, segFilter, sortKey, sortDir]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const elite = filtered.filter((s) => s.segment === "elite").length;
    const growth = filtered.filter((s) => s.segment === "growth").length;
    const atRisk = filtered.filter((s) => s.segment === "at_risk").length;
    const avg = total ? filtered.reduce((a, s) => a + s.health_score, 0) / total : 0;
    return { total, elite, growth, atRisk, avg };
  }, [filtered]);

  const pieData = [
    { name: "Elite", value: stats.elite, color: SEGMENT_COLORS.elite },
    { name: "Growth", value: stats.growth, color: SEGMENT_COLORS.growth },
    { name: "At Risk", value: stats.atRisk, color: SEGMENT_COLORS.at_risk },
  ];

  const metricAvg = useMemo(() => {
    const keys: [keyof SegmentationScore, string][] = [
      ["quality_score", "Quality"],
      ["planned_leaves_score", "Planned"],
      ["emergency_leaves_score", "Emerg."],
      ["live_issues_score", "Issues"],
      ["cs_tickets_score", "CS"],
      ["communication_score", "Comm"],
      ["tl_feedback_score", "TL Fb"],
      ["engagement_score", "Engage"],
      ["parent_handling_score", "Parent"],
      ["culture_fit_score", "Culture"],
    ];
    return keys.map(([k, label]) => {
      const vals = filtered.map((s) => s[k] as number | null).filter((v): v is number => v != null);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { metric: label, avg: Math.round(avg) };
    });
  }, [filtered]);

  const toggleSort = (k: keyof SegmentationScore) => {
    if (sortKey === k) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const handleRecompute = async () => {
    try {
      await recompute({
        filters: {
          search: search || undefined,
          team_leader: tlFilter !== "all" ? tlFilter : undefined,
          language: langFilter !== "all" ? langFilter : undefined,
          segment: segFilter !== "all" ? segFilter : undefined,
        },
      });
      toast.success("Segmentation recomputed");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to recompute");
    }
  };

  return (
    <AppLayout title="Tutor Segmentation" allowedRoles={["admin", "team_leader", "super_team_leader"]}>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold">Tutor Segmentation</h2>
            <p className="text-sm text-muted-foreground">Weighted Tutor Health Score with automatic Elite / Growth / At Risk classification.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setAuditOpen(true)}>
              <History className="h-4 w-4 mr-2" /> Audit log
            </Button>
            <Button variant="outline" onClick={() => setExportOpen(true)}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            {isAdmin && (
              <Button onClick={handleRecompute} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Recompute
              </Button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          {[
            { l: "Total Tutors", v: stats.total },
            { l: "Elite", v: stats.elite, c: "text-emerald-600" },
            { l: "Growth", v: stats.growth, c: "text-blue-600" },
            { l: "At Risk", v: stats.atRisk, c: "text-orange-600" },
            { l: "Avg Health", v: stats.avg.toFixed(1) },
          ].map((k) => (
            <Card key={k.l}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{k.l}</div>
                <div className={`text-2xl font-semibold ${k.c ?? ""}`}>{k.v}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Segment Distribution</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Metric Averages</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metricAvg}>
                  <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="avg" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-2">
            <Input placeholder="Search tutor..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={tlFilter} onValueChange={setTlFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Team Leader" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Team Leaders</SelectItem>
                {teamLeaders.map((tl) => <SelectItem key={tl} value={tl}>{tl}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={langFilter} onValueChange={setLangFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Language" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {languages.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={segFilter} onValueChange={setSegFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Segment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Segments</SelectItem>
                <SelectItem value="elite">Elite</SelectItem>
                <SelectItem value="growth">Growth</SelectItem>
                <SelectItem value="at_risk">At Risk</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Tutors ({filtered.length})</CardTitle>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tutor ID</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("tutor_name")}>Name</TableHead>
                  <TableHead>Team Leader</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("health_score")}>Health</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead className="text-right">Quality</TableHead>
                  <TableHead className="text-right">Leaves</TableHead>
                  <TableHead className="text-right">Issues</TableHead>
                  <TableHead className="text-right">CS</TableHead>
                  <TableHead className="text-right">Engage</TableHead>
                  <TableHead className="text-right">Parent</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Next Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                    No data. {isAdmin && "Click Recompute to generate the first snapshot."}
                  </TableCell></TableRow>
                )}
                {filtered.map((s) => {
                  const leaves = s.planned_leaves_score != null && s.emergency_leaves_score != null
                    ? Math.round((s.planned_leaves_score + s.emergency_leaves_score) / 2)
                    : null;
                  return (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelected(s)}>
                      <TableCell className="font-mono text-xs">{s.tutor_external_id}</TableCell>
                      <TableCell className="font-medium">{s.tutor_name}</TableCell>
                      <TableCell className="text-xs">{s.team_leader ?? "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{s.health_score.toFixed(1)}</TableCell>
                      <TableCell><SegmentBadge segment={s.segment} /></TableCell>
                      <TableCell><TrendIndicator trend={s.trend} /></TableCell>
                      <TableCell className="text-right">{s.quality_score?.toFixed(0) ?? "—"}</TableCell>
                      <TableCell className="text-right">{leaves ?? "—"}</TableCell>
                      <TableCell className="text-right">{s.live_issues_score?.toFixed(0) ?? "—"}</TableCell>
                      <TableCell className="text-right">{s.cs_tickets_score?.toFixed(0) ?? "—"}</TableCell>
                      <TableCell className="text-right">{s.engagement_score?.toFixed(0) ?? "—"}</TableCell>
                      <TableCell className="text-right">{s.parent_handling_score?.toFixed(0) ?? "—"}</TableCell>
                      <TableCell className="text-xs capitalize">{s.confidence}</TableCell>
                      <TableCell className="text-xs">{s.next_action ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <TutorProfileDialog
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          score={selected}
          recommendations={recommendations}
        />
        <AuditLogDialog open={auditOpen} onOpenChange={setAuditOpen} />
      </div>
    </AppLayout>
  );
}
