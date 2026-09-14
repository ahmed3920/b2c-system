import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, RefreshCw } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { SearchableSelect } from "@/components/tracking/quality/QualityFilterBar";
import { downloadCsv } from "@/lib/exportCsv";
import { PROJECTS_BASELINE, useProjectUploads } from "@/hooks/useProjectUploads";

export function ProjectUploadsTab() {
  const [teamLeader, setTeamLeader] = useState("");
  const [grade, setGrade] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const {
    summary,
    byGrade,
    byTeamLeader,
    distribution,
    bySessionType,
    uploadsByDay,
    students,
    notStarted,
    options,
    trend,
    loading,
    error,
    refetch,
  } = useProjectUploads({ teamLeader, grade, search });

  const zero = summary?.zero_students ?? 0;

  const trendData = useMemo(() => {
    const rows = trend.map((t) => ({ date: t.snapshot_date, zero: t.zero_students }));
    const today = new Date().toISOString().slice(0, 10);
    if (!rows.some((r) => r.date === today) && summary) rows.push({ date: today, zero });
    return rows;
  }, [trend, summary, zero]);

  const vsBaseline = zero - PROJECTS_BASELINE.zero;
  const previous = trendData.length > 1 ? trendData[trendData.length - 2].zero : null;
  const vsPrevious = previous === null ? null : zero - previous;

  const groupRow = bySessionType.find((r) => r.session_type === "Group");
  const oneToOneRow = bySessionType.find((r) => r.session_type === "One-to-one");

  const decreasePctVsBaseline =
    PROJECTS_BASELINE.zero > 0
      ? ((PROJECTS_BASELINE.zero - zero) / PROJECTS_BASELINE.zero) * 100
      : null;
  const decreasePctVsPrevious =
    previous && previous > 0 ? ((previous - zero) / previous) * 100 : null;

  const decreaseTrendData = useMemo(() => {
    return trendData.map((r, i) => {
      const prev = i > 0 ? trendData[i - 1].zero : null;
      const daily = prev && prev > 0 ? ((prev - r.zero) / prev) * 100 : 0;
      const cumulative =
        PROJECTS_BASELINE.zero > 0
          ? ((PROJECTS_BASELINE.zero - r.zero) / PROJECTS_BASELINE.zero) * 100
          : null;
      return {
        date: r.date,
        daily: Math.round(daily * 100) / 100,
        cumulative: cumulative === null ? null : Math.round(cumulative * 100) / 100,
      };
    });
  }, [trendData]);

  const exportNotStartedCsv = () => {
    downloadCsv(
      "not-started-zero-project-students",
      ["Student ID", "Student", "Grade", "Tutor", "T-ID", "Team leader"],
      notStarted.map((s) => [s.s_id, s.student_name, s.grade, s.tutor_name, s.tutor_tid, s.team_leader]),
    );
  };

  const exportCsv = () => {
    downloadCsv(
      "zero-project-students",
      ["Student ID", "Student", "Grade", "Tutor", "T-ID", "Team leader", "Attended sessions"],
      students.map((s) => [
        s.s_id,
        s.student_name,
        s.grade,
        s.tutor_name,
        s.tutor_tid,
        s.team_leader,
        s.attended_sessions,
      ]),
    );
  };

  const fmtDelta = (v: number | null) =>
    v === null ? "—" : v > 0 ? `+${v}` : String(v);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Team leader</Label>
            <SearchableSelect
              value={teamLeader}
              onChange={setTeamLeader}
              options={options.teamLeaders}
              allLabel="All team leaders"
            />
          </div>
          <div className="space-y-1">
            <Label>Grade</Label>
            <SearchableSelect
              value={grade}
              onChange={setGrade}
              options={options.grades}
              allLabel="All grades"
            />
          </div>
          <div className="space-y-1">
            <Label>Search student</Label>
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
              onBlur={() => setSearch(searchInput)}
              placeholder="Student ID or name"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={refetch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={!students.length}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Students with 0 projects", String(zero)],
          [`Change vs baseline (${PROJECTS_BASELINE.zero} on ${PROJECTS_BASELINE.date})`, fmtDelta(vsBaseline)],
          ["Change vs previous day", fmtDelta(vsPrevious)],
          [
            "Decrease % vs baseline",
            decreasePctVsBaseline === null ? "—" : `${decreasePctVsBaseline.toFixed(2)}%`,
          ],
          [
            "Decrease % vs previous day",
            decreasePctVsPrevious === null ? "—" : `${decreasePctVsPrevious.toFixed(2)}%`,
          ],
          ["Students tracked", String(summary?.students ?? 0)],
          [
            "Not started yet (0 sessions, 0 projects)",
            String(summary?.not_started_students ?? 0),
          ],
          [
            "Group-session students",
            `${groupRow?.students ?? 0} (${groupRow?.zero_students ?? 0} with 0 projects)`,
          ],
          [
            "One-to-one students",
            `${oneToOneRow?.students ?? 0} (${oneToOneRow?.zero_students ?? 0} with 0 projects)`,
          ],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daily trend — students with 0 projects</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="zero" name="0-project students" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Projects uploaded per day</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={uploadsByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="projects" name="Projects uploaded" fill="hsl(var(--primary))" />
              <Bar dataKey="students" name="Students uploading" fill="hsl(var(--destructive))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Decrease trend (% of students with 0 projects)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={decreaseTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v: number) => `${v}%`}
                domain={["auto", "auto"]}
              />
              <Tooltip formatter={(value: number | null) => (value === null ? "—" : `${value}%`)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="daily"
                name="Daily decrease %"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="cumulative"
                name="Cumulative decrease vs baseline %"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Group sessions vs one-to-one students</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bySessionType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="session_type" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="students" name="All tracked students" fill="hsl(var(--primary))" />
              <Bar dataKey="zero_students" name="Students with 0 projects" fill="hsl(var(--destructive))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">0-project students by grade</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byGrade}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="grade" tick={{ fontSize: 10 }} interval={0} angle={-20} height={70} textAnchor="end" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="zero_students" name="Students" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">0-project students by team leader</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byTeamLeader} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="team_leader" width={150} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="zero_students" name="Students" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Students by project count (0 to 12+)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="students" name="Students" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Students with 0 projects ({students.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Tutor</TableHead>
                <TableHead>Team leader</TableHead>
                <TableHead className="text-right">Attended sessions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !students.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : students.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No students</TableCell></TableRow>
              ) : (
                students.map((s) => (
                  <TableRow key={s.s_id}>
                    <TableCell className="font-medium">{s.s_id}</TableCell>
                    <TableCell>{s.student_name ?? "—"}</TableCell>
                    <TableCell>{s.grade ?? "—"}</TableCell>
                    <TableCell>{s.tutor_name ?? "—"}{s.tutor_tid ? ` (${s.tutor_tid})` : ""}</TableCell>
                    <TableCell>{s.team_leader}</TableCell>
                    <TableCell className="text-right">{s.attended_sessions}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Not started yet — upcoming session but 0 attended sessions, 0 projects ({summary?.not_started_students ?? notStarted.length})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportNotStartedCsv} disabled={!notStarted.length}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Tutor</TableHead>
                <TableHead>Team leader</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !notStarted.length ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : notStarted.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No students</TableCell></TableRow>
              ) : (
                notStarted.map((s) => (
                  <TableRow key={s.s_id}>
                    <TableCell className="font-medium">{s.s_id}</TableCell>
                    <TableCell>{s.student_name ?? "—"}</TableCell>
                    <TableCell>{s.grade ?? "—"}</TableCell>
                    <TableCell>{s.tutor_name ?? "—"}{s.tutor_tid ? ` (${s.tutor_tid})` : ""}</TableCell>
                    <TableCell>{s.team_leader}</TableCell>
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
