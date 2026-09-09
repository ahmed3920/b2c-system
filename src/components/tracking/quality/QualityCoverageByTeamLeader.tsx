import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import { cycleLabel } from "@/lib/tutorStatus";
import { useQualityCoverage, type CoverageByTeamLeader } from "@/hooks/useQualityCoverage";

type Props = {
  rows: CoverageByTeamLeader[];
  loading: boolean;
  cycle: string | null;
  /** Called when a row's "View" link is used. */
  onSelect: (teamLeader: string) => void;
};

/** Missing reviews per team leader for the selected cycle. */
export function QualityCoverageByTeamLeader({ rows, loading, cycle, onSelect }: Props) {
  const totalMissing = rows.reduce((a, r) => a + (r.missing ?? 0), 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          Missing reviews by team leader
          <span className="text-sm font-normal text-muted-foreground">
            {cycle ? cycleLabel(cycle) : "latest cycle"}
          </span>
          {totalMissing > 0 && (
            <Badge variant="destructive">{totalMissing.toLocaleString()} missing</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team leader</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="text-right">Reviewed</TableHead>
                <TableHead className="text-right">Missing</TableHead>
                <TableHead className="text-right">No sessions</TableHead>
                <TableHead className="w-[180px]">Coverage</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    No tutors match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const due = (r.reviewed ?? 0) + (r.missing ?? 0);
                  const pct = due ? Math.round(((r.reviewed ?? 0) / due) * 100) : 0;
                  return (
                    <TableRow key={r.team_leader ?? "unassigned"}>
                      <TableCell className="font-medium">{r.team_leader ?? "Unassigned"}</TableCell>
                      <TableCell className="text-right">{due.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{(r.reviewed ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {(r.missing ?? 0) > 0 ? (
                          <Badge variant="destructive">{(r.missing ?? 0).toLocaleString()}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {(r.no_sessions ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2" />
                          <span className="text-xs text-muted-foreground w-9 text-right">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSelect(r.team_leader ?? "")}
                          disabled={!r.team_leader}
                        >
                          View <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Self-contained version for the Overview tab: loads its own coverage data
 * for the latest cycle and links through to the Review Coverage tab.
 */
export function QualityCoverageByTeamLeaderCard() {
  const c = useQualityCoverage();
  const navigate = useNavigate();

  return (
    <QualityCoverageByTeamLeader
      rows={c.byTeamLeader}
      loading={c.byTeamLeaderLoading}
      cycle={c.filters.cycle}
      onSelect={(tl) =>
        navigate(
          `/performance?tab=quality&sub=coverage&coverage_tl=${encodeURIComponent(tl)}` +
            (c.filters.cycle ? `&coverage_cycle=${encodeURIComponent(c.filters.cycle)}` : ""),
        )
      }
    />
  );
}
