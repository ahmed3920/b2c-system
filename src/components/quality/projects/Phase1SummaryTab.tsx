import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { downloadCsv } from "@/lib/exportCsv";
import { usePhase1Summary } from "@/hooks/useProjectReviews";
import { pct } from "@/lib/projectEvaluation";

const thisMonth = new Date().toISOString().slice(0, 7);

/** Coverage 40% + QC functionality 60% = Phase 1 outcome, for a month. */
export function Phase1SummaryTab() {
  const [month, setMonth] = useState(thisMonth);
  const [teamLeader, setTeamLeader] = useState("");
  const { perTutor, totals, loading, error, refetch } = usePhase1Summary(month, teamLeader);

  const exportCsv = () =>
    downloadCsv(
      `phase1-${month}`,
      ["Tutor", "Tutor ID", "Team leader", "Eligible students", "Uploaded", "Coverage %", "Reviewed", "Functionality %", "Phase 1 outcome %"],
      perTutor.map((r) => [
        r.tutor_name,
        r.tutor_tid,
        r.team_leader,
        r.eligible_students,
        r.uploaded_students,
        r.coveragePct.toFixed(1),
        r.reviewed,
        r.funcPct === null ? "" : r.funcPct.toFixed(1),
        r.outcome === null ? "" : r.outcome.toFixed(1),
      ]),
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Month</Label>
            <Input type="month" className="h-9 w-[170px]" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Team leader</Label>
            <Input
              className="h-9 w-[220px]"
              placeholder="All team leaders"
              defaultValue={teamLeader}
              onBlur={(e) => setTeamLeader(e.target.value.trim())}
            />
          </div>
          <Button variant="outline" className="h-9" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" className="h-9" onClick={exportCsv} disabled={!perTutor.length}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Coverage", value: pct(totals.coveragePct), sub: `${totals.uploaded} of ${totals.eligible} students` },
          { label: "QC functionality", value: pct(totals.funcPct ?? undefined), sub: `${totals.reviewed} projects scored` },
          { label: "Phase 1 outcome", value: pct(totals.outcome ?? undefined), sub: "Coverage 40% + functionality 60%" },
          { label: "Pending recheck", value: String(totals.pending), sub: "Blocked by a technical issue" },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Per full-time tutor {loading && <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Team leader</TableHead>
                  <TableHead className="text-right">Eligible</TableHead>
                  <TableHead className="text-right">Uploaded</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                  <TableHead className="text-right">Reviewed</TableHead>
                  <TableHead className="text-right">Functionality</TableHead>
                  <TableHead className="text-right">Phase 1</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perTutor.map((r) => (
                  <TableRow key={`${r.tutor_tid}-${r.tutor_name}`}>
                    <TableCell>
                      {r.tutor_name ?? "—"}
                      <span className="block text-xs text-muted-foreground">{r.tutor_tid}</span>
                    </TableCell>
                    <TableCell>{r.team_leader}</TableCell>
                    <TableCell className="text-right">{r.eligible_students}</TableCell>
                    <TableCell className="text-right">{r.uploaded_students}</TableCell>
                    <TableCell className="text-right">{pct(r.coveragePct)}</TableCell>
                    <TableCell className="text-right">{r.reviewed}</TableCell>
                    <TableCell className="text-right">{pct(r.funcPct ?? undefined)}</TableCell>
                    <TableCell className="text-right font-medium">{pct(r.outcome ?? undefined)}</TableCell>
                  </TableRow>
                ))}
                {!loading && !perTutor.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No tutor data for this month.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
