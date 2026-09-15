import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2 } from "lucide-react";
import { downloadCsv } from "@/lib/exportCsv";
import { ProjectFilterBar } from "./ProjectFilterBar";
import { ProjectDetailDialog } from "./ProjectDetailDialog";
import { useEvaluations } from "@/hooks/useProjectReviews";
import { statusShortLabel } from "@/lib/projectEvaluation";
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  signProjectFiles,
  useProjectAudit,
  type ProjectFilters,
  type ProjectRow,
  type SignedFile,
} from "@/hooks/useProjectAudit";


export function ProjectAuditTab({ pendingOnly = false }: { pendingOnly?: boolean }) {
  const [filters, setFilters] = useState<ProjectFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<ProjectRow | null>(null);

  const { rows, summary, options, loading, error, refetch } = useProjectAudit(filters, page);
  const { evaluations, refetch: refetchEvaluations } = useEvaluations(
    rows.map((r) => Number(r.project_id)),
  );

  const [thumbs, setThumbs] = useState<Record<string, SignedFile>>({});

  useEffect(() => {
    let active = true;
    const items = rows
      .filter((r) => r.cover_key)
      .slice(0, 60)
      .map((r) => ({ project_id: Number(r.project_id), key: r.cover_key as string }));
    if (!items.length) {
      setThumbs({});
      return;
    }
    signProjectFiles(items)
      .then((signed) => active && setThumbs(signed))
      .catch(() => active && setThumbs({}));
    return () => {
      active = false;
    };
  }, [rows]);

  const visible = pendingOnly ? rows.filter((r) => !evaluations[Number(r.project_id)]) : rows;


  const update = (next: Partial<ProjectFilters>) => {
    setPage(0);
    setFilters((f) => ({ ...f, ...next }));
  };

  const exportCsv = () => {
    downloadCsv(
      pendingOnly ? "projects-pending-approval" : "projects-audit",
      [
        "Project ID",
        "Title",
        "Student",
        "Student ID",
        "Grade",
        "Tutor",
        "Tutor ID",
        "Team leader",
        "Module",
        "Lesson",
        "Uploaded",
        "Published",
        "Score",
        "Views",
        "Likes",
        "Comments",
        "Evaluation",
        "Points",
        "Note",
      ],
      visible.map((r) => {
        const e = evaluations[Number(r.project_id)];
        return [
          r.project_id,
          r.title,
          r.student_name,
          r.s_id,
          r.grade,
          r.tutor_name,
          r.tutor_tid,
          r.team_leader,
          r.module,
          r.lesson,
          r.created_at,
          r.published ? "Yes" : "No",
          r.final_score,
          r.views_count,
          r.likes_count,
          r.comments_count,
          statusShortLabel(e?.status),
          e ? e.points : "",
          e?.note ?? "",
        ];
      }),

    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <ProjectFilterBar
            filters={filters}
            onChange={update}
            teamLeaders={options.teamLeaders}
            grades={options.grades}
            onRefresh={refetch}
          />
        </CardContent>
      </Card>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Projects", value: summary.projects },
            { label: "Students", value: summary.students },
            { label: "Published", value: summary.published },
            { label: "Archived", value: summary.archived },
          ].map((k) => (
            <Card key={k.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{k.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{k.value ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {pendingOnly ? "Awaiting approval" : "Uploaded projects"}
            {loading && <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!visible.length}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[64px]">Cover</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Team leader</TableHead>
                  <TableHead>Module / Lesson</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => {
                  const e = evaluations[Number(r.project_id)];
                  return (
                    <TableRow
                      key={r.project_id}
                      className="cursor-pointer"
                      onClick={() => setOpen(r)}
                    >
                      <TableCell>
                        {r.cover_key && thumbs[r.cover_key] ? (
                          <img
                            src={thumbs[r.cover_key].url}
                            alt=""
                            className="h-10 w-14 object-cover rounded border"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-10 w-14 rounded border bg-muted" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{r.title || "Untitled"}</TableCell>
                      <TableCell>
                        {r.student_name}
                        <span className="block text-xs text-muted-foreground">{r.s_id}</span>
                      </TableCell>
                      <TableCell>{r.grade ?? "—"}</TableCell>
                      <TableCell>
                        {r.tutor_name ?? "—"}
                        <span className="block text-xs text-muted-foreground">{r.tutor_tid}</span>
                      </TableCell>
                      <TableCell>{r.team_leader}</TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {[r.module, r.lesson].filter(Boolean).join(" / ") || "—"}
                      </TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">{r.views_count}</TableCell>
                      <TableCell className="text-right">{r.likes_count}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            e?.status === "fully_working"
                              ? "default"
                              : e?.status === "not_working" || e?.status === "invalid_submission"
                                ? "destructive"
                                : e
                                  ? "secondary"
                                  : "outline"
                          }
                        >
                          {statusShortLabel(e?.status)}
                        </Badge>
                      </TableCell>

                    </TableRow>
                  );
                })}
                {!loading && visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      No projects match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {page + 1}
              {summary ? ` — ${summary.projects} projects` : ""}
            </p>
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

      <ProjectDetailDialog
        project={open}
        evaluation={open ? evaluations[Number(open.project_id)] : undefined}
        onClose={() => setOpen(null)}
        onEvaluated={refetchEvaluations}
      />

    </div>
  );
}
