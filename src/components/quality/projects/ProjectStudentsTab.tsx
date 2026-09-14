import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { downloadCsv } from "@/lib/exportCsv";
import { SearchableSelect } from "@/components/tracking/quality/QualityFilterBar";
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  useProjectAudit,
  useProjectStudents,
  useStudentDetail,
  type StudentDashboardRow,
} from "@/hooks/useProjectAudit";

export function ProjectStudentsTab() {
  const [teamLeader, setTeamLeader] = useState("");
  const [grade, setGrade] = useState("");
  const [search, setSearch] = useState("");
  const [stalledOnly, setStalledOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<StudentDashboardRow | null>(null);

  const { options } = useProjectAudit(EMPTY_FILTERS, 0);
  const { rows, summary, loading, error, refetch } = useProjectStudents(
    { teamLeader, grade, search, stalledOnly },
    page,
  );
  const detail = useStudentDetail(open?.student_id ?? null);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Team leader</Label>
            <SearchableSelect
              value={teamLeader}
              onChange={(v) => {
                setPage(0);
                setTeamLeader(v);
              }}
              options={options.teamLeaders}
              allLabel="All team leaders"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Grade</Label>
            <SearchableSelect
              value={grade}
              onChange={(v) => {
                setPage(0);
                setGrade(v);
              }}
              options={options.grades}
              allLabel="All grades"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Search</Label>
            <Input
              className="h-9 w-[220px]"
              placeholder="Student name or ID"
              defaultValue={search}
              onBlur={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(0);
                  setSearch((e.target as HTMLInputElement).value);
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Switch
              checked={stalledOnly}
              onCheckedChange={(v) => {
                setPage(0);
                setStalledOnly(v);
              }}
            />
            <Label className="text-sm">Stalled only</Label>
          </div>
          <Button variant="outline" size="sm" className="h-9" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Students", value: summary.students },
            { label: "Projects", value: summary.projects ?? 0 },
            { label: "No project yet", value: summary.zero_projects },
            { label: "Stalled (14+ days)", value: summary.stalled },
          ].map((k) => (
            <Card key={k.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{k.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{Number(k.value).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Students {loading && <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={!rows.length}
            onClick={() =>
              downloadCsv(
                "project-students",
                ["Student ID", "Student", "Grade", "Team leader", "Tutor", "Projects", "Attended sessions", "Last upload", "Stalled"],
                rows.map((r) => [
                  r.s_id,
                  r.student_name,
                  r.grade,
                  r.team_leader,
                  r.tutor_name,
                  r.projects,
                  r.attended_sessions,
                  r.last_upload,
                  r.stalled ? "Yes" : "No",
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
                <TableHead>Tutor</TableHead>
                <TableHead className="text-right">Projects</TableHead>
                <TableHead className="text-right">Sessions attended</TableHead>
                <TableHead>Last upload</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.student_id} className="cursor-pointer" onClick={() => setOpen(r)}>
                  <TableCell>
                    {r.student_name}
                    <span className="block text-xs text-muted-foreground">{r.s_id}</span>
                  </TableCell>
                  <TableCell>{r.grade ?? "—"}</TableCell>
                  <TableCell>{r.team_leader}</TableCell>
                  <TableCell>{r.tutor_name ?? "—"}</TableCell>
                  <TableCell className="text-right">{r.projects}</TableCell>
                  <TableCell className="text-right">{r.attended_sessions}</TableCell>
                  <TableCell>{r.last_upload ? new Date(r.last_upload).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    {r.stalled ? <Badge variant="destructive">Stalled</Badge> : <Badge variant="secondary">OK</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No students match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">Page {page + 1}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={rows.length < PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {open?.student_name} {open?.s_id ? `(${open.s_id})` : ""}
            </DialogTitle>
          </DialogHeader>
          {detail.loading && <Loader2 className="h-5 w-5 animate-spin" />}
          <div className="space-y-6">
            <div>
              <p className="font-medium mb-2">Projects ({detail.projects.length})</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Module / Lesson</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.projects.map((p) => (
                    <TableRow key={p.project_id}>
                      <TableCell>
                        {p.url ? (
                          <a className="underline" href={p.url} target="_blank" rel="noreferrer">
                            {p.title || "Untitled"}
                          </a>
                        ) : (
                          p.title || "Untitled"
                        )}
                      </TableCell>
                      <TableCell>{[p.module, p.lesson].filter(Boolean).join(" / ") || "—"}</TableCell>
                      <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{p.published ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">{p.views_count ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <p className="font-medium mb-2">Session history ({detail.sessions.length})</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Module / Lesson</TableHead>
                    <TableHead>Tutor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Projects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.sessions.slice(0, 100).map((s) => (
                    <TableRow key={s.session_id}>
                      <TableCell>{s.start_at ? new Date(s.start_at).toLocaleString() : "—"}</TableCell>
                      <TableCell>{[s.module, s.lesson].filter(Boolean).join(" / ") || "—"}</TableCell>
                      <TableCell>{s.tutor_name ?? "—"}</TableCell>
                      <TableCell>{s.group_session_id ? "Group" : "One-to-one"}</TableCell>
                      <TableCell className="text-right">{s.projects}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
