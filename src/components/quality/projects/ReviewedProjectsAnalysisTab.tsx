import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2 } from "lucide-react";
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
import { downloadCsv } from "@/lib/exportCsv";
import { statusShortLabel } from "@/lib/projectEvaluation";
import { ReviewedFilterBar } from "./ReviewedFilterBar";
import {
  analyseReviewed,
  EMPTY_REVIEWED_FILTERS,
  useReviewedProjects,
  type ReviewedFilters,
} from "@/hooks/useReviewedProjects";

const hideZero = (v: unknown) => (Number(v) > 0 ? String(v) : "");

const STATUS_COLOR: Record<string, string> = {
  fully_working: "hsl(var(--primary))",
  partially_working: "hsl(var(--primary) / 0.5)",
  not_working: "hsl(var(--destructive))",
  invalid_submission: "hsl(var(--destructive) / 0.55)",
  pending: "hsl(var(--muted-foreground) / 0.6)",
};

export function ReviewedProjectsAnalysisTab() {
  const [filters, setFilters] = useState<ReviewedFilters>(EMPTY_REVIEWED_FILTERS);
  const { rows, options, loading, error, refetch } = useReviewedProjects(filters);

  const update = (next: Partial<ReviewedFilters>) => setFilters((f) => ({ ...f, ...next }));

  const a = useMemo(() => analyseReviewed(rows), [rows]);

  const statusData = a.byStatus
    .filter((s) => s.value > 0)
    .map((s) => ({ ...s, name: statusShortLabel(s.status as any) }));

  const topTutors = a.byTutor.slice(0, 15);

  const exportTeamCsv = () =>
    downloadCsv(
      "reviewed-projects-by-team-leader",
      ["Team leader", "Reviewed", "Fully working", "Partially working", "Not working / invalid", "Avg points", "Pass rate %"],
      a.byTeamLeader.map((t) => [
        t.team_leader,
        t.total,
        t.fully,
        t.partial,
        t.failed,
        t.avg_points,
        t.pass_rate,
      ]),
    );

  const exportTutorCsv = () =>
    downloadCsv(
      "reviewed-projects-by-tutor",
      ["Tutor", "Reviewed", "Not working / invalid", "Avg points"],
      a.byTutor.map((t) => [t.tutor, t.total, t.failed, t.avg_points]),
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <ReviewedFilterBar
            filters={filters}
            onChange={update}
            teamLeaders={options.teamLeaders}
            reviewers={options.reviewers}
            onRefresh={refetch}
            showSearch={false}
          />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Reviewed projects", value: a.total.toLocaleString() },
          { label: "Students covered", value: a.students.toLocaleString() },
          { label: "Tutors covered", value: a.tutors.toLocaleString() },
          { label: "Reviewers", value: a.reviewers.toLocaleString() },
          { label: "Average points (of 5)", value: a.avgPoints.toFixed(2) },
          { label: "Fully working rate", value: `${a.passRate}%` },
          { label: "Not working / invalid rate", value: `${a.failRate}%` },
          { label: "Pending recheck", value: a.pendingRecheck.toLocaleString() },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Review results
              {loading && <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]" data-chart="Review results">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={110}
                  label={(e: any) => `${e.name}: ${e.value}`}
                >
                  {statusData.map((s) => (
                    <Cell key={s.status} fill={STATUS_COLOR[s.status] ?? "hsl(var(--primary))"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reviews per day</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]" data-chart="Reviews per day">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={a.byDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="total" name="Reviews" stroke="hsl(var(--primary))" strokeWidth={2}>
                  <LabelList dataKey="total" position="top" fontSize={11} formatter={hideZero} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reviewed projects by team leader</CardTitle>
          </CardHeader>
          <CardContent className="h-[360px]" data-chart="Reviewed projects by team leader">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.byTeamLeader.slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="team_leader" fontSize={10} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="fully" name="Fully working" stackId="s" fill="hsl(var(--primary))" />
                <Bar dataKey="partial" name="Partially working" stackId="s" fill="hsl(var(--primary) / 0.45)" />
                <Bar dataKey="failed" name="Not working / invalid" stackId="s" fill="hsl(var(--destructive))">
                  <LabelList dataKey="total" position="top" fontSize={11} formatter={hideZero} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reviews by reviewer</CardTitle>
          </CardHeader>
          <CardContent className="h-[360px]" data-chart="Reviews by reviewer">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.byReviewer} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis type="category" dataKey="reviewer" width={130} interval={0} fontSize={10} />
                <Tooltip />
                <Bar dataKey="total" name="Reviews" fill="hsl(var(--primary))">
                  <LabelList dataKey="total" position="right" fontSize={11} formatter={hideZero} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Average points by team leader (of 5)</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px]" data-chart="Average points by team leader">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.byTeamLeader.slice(0, 20)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="team_leader" fontSize={10} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis domain={[0, 5]} fontSize={11} />
                <Tooltip />
                <Bar dataKey="avg_points" name="Average points" fill="hsl(var(--primary))">
                  <LabelList dataKey="avg_points" position="top" fontSize={11} formatter={hideZero} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">By team leader</CardTitle>
          <Button variant="outline" size="sm" onClick={exportTeamCsv} disabled={!a.byTeamLeader.length}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team leader</TableHead>
                <TableHead className="text-right">Reviewed</TableHead>
                <TableHead className="text-right">Fully working</TableHead>
                <TableHead className="text-right">Partially working</TableHead>
                <TableHead className="text-right">Not working / invalid</TableHead>
                <TableHead className="text-right">Avg points</TableHead>
                <TableHead className="text-right">Fully working %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.byTeamLeader.map((t) => (
                <TableRow key={t.team_leader}>
                  <TableCell>{t.team_leader}</TableCell>
                  <TableCell className="text-right">{t.total}</TableCell>
                  <TableCell className="text-right">{t.fully}</TableCell>
                  <TableCell className="text-right">{t.partial}</TableCell>
                  <TableCell className="text-right">{t.failed}</TableCell>
                  <TableCell className="text-right">{t.avg_points}</TableCell>
                  <TableCell className="text-right">{t.pass_rate}%</TableCell>
                </TableRow>
              ))}
              {!loading && !a.byTeamLeader.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No reviewed projects match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Top tutors by reviewed projects</CardTitle>
          <Button variant="outline" size="sm" onClick={exportTutorCsv} disabled={!a.byTutor.length}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tutor</TableHead>
                <TableHead className="text-right">Reviewed</TableHead>
                <TableHead className="text-right">Not working / invalid</TableHead>
                <TableHead className="text-right">Avg points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topTutors.map((t) => (
                <TableRow key={t.tutor}>
                  <TableCell>{t.tutor}</TableCell>
                  <TableCell className="text-right">{t.total}</TableCell>
                  <TableCell className="text-right">{t.failed}</TableCell>
                  <TableCell className="text-right">{t.avg_points}</TableCell>
                </TableRow>
              ))}
              {!loading && !topTutors.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No reviewed projects match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
