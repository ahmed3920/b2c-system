import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { downloadCsv } from "@/lib/exportCsv";
import { ProjectFilterBar } from "./ProjectFilterBar";
import { EMPTY_FILTERS, useProjectAudit, useProjectEngagement, type ProjectFilters } from "@/hooks/useProjectAudit";

type SortKey = "views" | "likes" | "comments" | "projects";

export function ProjectEngagementTab() {
  const [filters, setFilters] = useState<ProjectFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("views");

  const { options } = useProjectAudit(filters, 0);
  const { students, byGrade, byTeamLeader, loading, error, refetch } = useProjectEngagement(filters);

  const sorted = [...students].sort((a, b) => (Number(b[sort] ?? 0) - Number(a[sort] ?? 0)));

  const totals = students.reduce(
    (acc, s) => ({
      views: acc.views + Number(s.views ?? 0),
      likes: acc.likes + Number(s.likes ?? 0),
      comments: acc.comments + Number(s.comments ?? 0),
      projects: acc.projects + Number(s.projects ?? 0),
    }),
    { views: 0, likes: 0, comments: 0, projects: 0 },
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <ProjectFilterBar
            filters={filters}
            onChange={(next) => setFilters((f) => ({ ...f, ...next }))}
            teamLeaders={options.teamLeaders}
            grades={options.grades}
            onRefresh={refetch}
          />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Projects", value: totals.projects },
          { label: "Views", value: totals.views },
          { label: "Likes", value: totals.likes },
          { label: "Comments", value: totals.comments },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{k.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagement by grade</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byGrade}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="views" name="Views" fill="hsl(var(--primary))" />
                <Bar dataKey="likes" name="Likes" fill="hsl(var(--accent))" />
                <Bar dataKey="comments" name="Comments" fill="hsl(var(--muted-foreground))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagement by team leader</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byTeamLeader}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="team_leader" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="views" name="Views" fill="hsl(var(--primary))" />
                <Bar dataKey="likes" name="Likes" fill="hsl(var(--accent))" />
                <Bar dataKey="comments" name="Comments" fill="hsl(var(--muted-foreground))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Per student {loading && <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={!students.length}
            onClick={() =>
              downloadCsv(
                "projects-engagement",
                ["Student ID", "Student", "Grade", "Team leader", "Tutor", "Projects", "Views", "Likes", "Comments"],
                sorted.map((s) => [
                  s.s_id,
                  s.student_name,
                  s.grade,
                  s.team_leader,
                  s.tutor_name,
                  s.projects,
                  s.views,
                  s.likes,
                  s.comments,
                ]),
              )
            }
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Team leader</TableHead>
                {(["projects", "views", "likes", "comments"] as SortKey[]).map((k) => (
                  <TableHead
                    key={k}
                    className="text-right cursor-pointer select-none capitalize"
                    onClick={() => setSort(k)}
                  >
                    {k}
                    {sort === k ? " ↓" : ""}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s) => (
                <TableRow key={`${s.s_id}-${s.student_name}`}>
                  <TableCell>
                    {s.student_name}
                    <span className="block text-xs text-muted-foreground">{s.s_id}</span>
                  </TableCell>
                  <TableCell>{s.grade ?? "—"}</TableCell>
                  <TableCell>{s.team_leader}</TableCell>
                  <TableCell className="text-right">{s.projects}</TableCell>
                  <TableCell className="text-right">{s.views ?? 0}</TableCell>
                  <TableCell className="text-right">{s.likes ?? 0}</TableCell>
                  <TableCell className="text-right">{s.comments ?? 0}</TableCell>
                </TableRow>
              ))}
              {!loading && sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No engagement data for these filters.
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
