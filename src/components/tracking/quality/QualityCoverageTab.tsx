import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { AlertTriangle, Download, ExternalLink, Loader2, RefreshCw, X } from "lucide-react";
import { Field, Kpi, SearchableSelect, downloadCsv } from "./QualityFilterBar";
import { QualityCoverageByTeamLeader } from "./QualityCoverageByTeamLeader";
import { runReplicaQuery } from "@/hooks/useReplicaQuery";
import { toast } from "@/hooks/use-toast";
import { tutorStatusLabel, cycleLabel, TUTOR_STATUS_OPTIONS } from "@/lib/tutorStatus";
import {
  useQualityCoverage,
  coverageStateLabel,
  COVERAGE_PAGE_SIZE,
  type CoverageState,
} from "@/hooks/useQualityCoverage";

const ALL = "all";

const stateBadge = (s: CoverageState) =>
  s === "missing"
    ? "bg-destructive text-destructive-foreground"
    : s === "reviewed"
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-muted-foreground";

export function QualityCoverageTab() {
  const c = useQualityCoverage();
  const [exporting, setExporting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const s = c.summary;

  // Deep link from the team-leader dashboard: ?coverage_tl=…&coverage_cycle=…
  const deepTl = searchParams.get("coverage_tl");
  const deepCycle = searchParams.get("coverage_cycle");
  useEffect(() => {
    if (!deepTl && !deepCycle) return;
    c.update({
      ...(deepTl ? { team_lead: deepTl, coverage: "missing" as CoverageState } : {}),
      ...(deepCycle ? { cycle: deepCycle } : {}),
    });
    const next = new URLSearchParams(searchParams);
    next.delete("coverage_tl");
    next.delete("coverage_cycle");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepTl, deepCycle]);

  const shown =
    c.filters.coverage === "all"
      ? (s?.total ?? 0)
      : c.filters.coverage === "missing"
        ? (s?.missing ?? 0)
        : c.filters.coverage === "reviewed"
          ? (s?.reviewed ?? 0)
          : (s?.no_sessions ?? 0);
  const pages = Math.max(1, Math.ceil(shown / COVERAGE_PAGE_SIZE));
  const expected = (s?.reviewed ?? 0) + (s?.missing ?? 0);
  const coveragePct = expected ? Math.round(((s?.reviewed ?? 0) / expected) * 100) : 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await runReplicaQuery<Record<string, unknown>>("quality_coverage_list", {
        ...c.baseParams,
        coverage: c.filters.coverage === "all" ? null : c.filters.coverage,
        limit: 5000,
        offset: 0,
      });
      const mapped = rows.map((r) => ({
        ...r,
        tutor_status: tutorStatusLabel(r.tutor_status as number),
        coverage_state: coverageStateLabel[r.coverage_state as CoverageState],
      }));
      if (!downloadCsv(`quality-coverage-${new Date().toISOString().slice(0, 10)}.csv`, mapped)) {
        toast({ title: "Nothing to export" });
      }
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const locked = c.scope.lockedTeamLead || c.scope.lockedMentor;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Tutors" value={(s?.total ?? 0).toLocaleString()} loading={c.summaryLoading} />
        <Kpi label="Reviewed" value={(s?.reviewed ?? 0).toLocaleString()} loading={c.summaryLoading} />
        <Kpi
          label="Missing review"
          value={(s?.missing ?? 0).toLocaleString()}
          hint="Had sessions, no review yet"
          loading={c.summaryLoading}
        />
        <Kpi
          label="No sessions"
          value={(s?.no_sessions ?? 0).toLocaleString()}
          hint="No review expected"
          loading={c.summaryLoading}
        />
        <Kpi label="Coverage" value={`${coveragePct}%`} hint="Of tutors with sessions" loading={c.summaryLoading} />
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">Filters</CardTitle>
            {locked && (
              <Badge variant="secondary" className="font-normal">
                {c.scope.lockedTeamLead ? "Team" : "Mentor"}: {c.scope.displayName ?? locked}
              </Badge>
            )}
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button size="sm" variant="ghost" onClick={c.reset}>
              <X className="w-3.5 h-3.5 mr-1.5" /> Clear
            </Button>
            <Button size="sm" variant="outline" onClick={c.refetch} disabled={c.loading}>
              {c.loading ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Refresh
            </Button>
            <Button size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Review cycle">
            <Select value={c.filters.cycle} onValueChange={(v) => c.update({ cycle: v })}>
              <SelectTrigger><SelectValue placeholder="Latest cycle" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {c.cycles.map((cy) => (
                  <SelectItem key={cy} value={cy}>{cycleLabel(cy)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Show">
            <Select
              value={c.filters.coverage}
              onValueChange={(v) => c.update({ coverage: v as CoverageState | "all" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="missing">Missing review</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="no_sessions">No sessions</SelectItem>
                <SelectItem value="all">All tutors</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tutor status">
            <Select
              value={c.filters.tutor_status || ALL}
              onValueChange={(v) => c.update({ tutor_status: v === ALL ? "" : v })}
            >
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {TUTOR_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tutor name or T-ID">
            <Input
              placeholder="e.g. T-4602"
              value={c.filters.tutor}
              onChange={(e) => c.update({ tutor: e.target.value })}
            />
          </Field>
          {!locked && (
            <Field label="Team leader">
              <SearchableSelect
                value={c.filters.team_lead}
                onChange={(v) => c.update({ team_lead: v })}
                options={c.options?.team_leaders ?? []}
                allLabel="All team leaders"
              />
            </Field>
          )}
          <Field label="Organization">
            <SearchableSelect
              value={c.filters.organization}
              onChange={(v) => c.update({ organization: v })}
              options={c.options?.organizations ?? []}
              allLabel="All organizations"
            />
          </Field>
        </CardContent>
      </Card>

      {!locked && (
        <QualityCoverageByTeamLeader
          rows={c.byTeamLeader}
          loading={c.byTeamLeaderLoading}
          cycle={c.filters.cycle}
          onSelect={(tl) => c.update({ team_lead: tl, coverage: "missing" })}
        />
      )}



      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            Review coverage
            <span className="text-sm font-normal text-muted-foreground">
              showing {c.rows.length} of {shown.toLocaleString()} · {cycleLabel(c.filters.cycle)}
            </span>
            {(s?.missing ?? 0) > 0 && (
              <Badge variant="destructive">{(s?.missing ?? 0).toLocaleString()} missing</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {c.error ? (
            <p className="text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              {c.error}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tutor</TableHead>
                      <TableHead>Tutor status</TableHead>
                      <TableHead>Team leader</TableHead>
                      <TableHead>Mentor</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead className="text-right">Held</TableHead>
                      <TableHead className="text-right">Upcoming</TableHead>
                      <TableHead className="text-right">Students</TableHead>
                      <TableHead className="text-right">Reviews</TableHead>
                      <TableHead className="w-[170px]">Review progress</TableHead>
                      <TableHead>State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.loading && c.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          Loading tutors…
                        </TableCell>
                      </TableRow>
                    ) : c.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          No tutors match these filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      c.rows.map((r) => (
                        <TableRow key={`${r.tutor_tid}-${r.cycle}`}>
                          <TableCell>
                            {r.tutor_name}
                            <span className="block text-xs text-muted-foreground">{r.tutor_tid}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.tutor_status === 0 ? "secondary" : "outline"}>
                              {tutorStatusLabel(r.tutor_status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{r.team_leader ?? "—"}</TableCell>
                          <TableCell className="text-sm">{r.mentor_name ?? "—"}</TableCell>
                          <TableCell className="text-sm max-w-[240px] truncate">
                            {r.organizations ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">{r.sessions.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {(r.sessions_upcoming ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {(r.student_sessions ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">{r.reviews.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={stateBadge(r.coverage_state)}>
                              {coverageStateLabel[r.coverage_state]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-3 text-sm">
                <span className="text-muted-foreground">
                  Page {c.page + 1} of {pages}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={c.page === 0 || c.loading}
                    onClick={() => c.setPage(c.page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={c.page + 1 >= pages || c.loading}
                    onClick={() => c.setPage(c.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
