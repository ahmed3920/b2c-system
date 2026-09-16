import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2 } from "lucide-react";
import { downloadCsv } from "@/lib/exportCsv";
import { statusShortLabel } from "@/lib/projectEvaluation";
import { ReviewedFilterBar } from "./ReviewedFilterBar";
import {
  EMPTY_REVIEWED_FILTERS,
  useReviewedProjects,
  type ReviewedFilters,
} from "@/hooks/useReviewedProjects";
import type { ProjectEvaluation } from "@/hooks/useProjectReviews";

const PAGE_SIZE = 50;

export function statusVariant(status: ProjectEvaluation["status"]) {
  if (status === "fully_working") return "default" as const;
  if (status === "not_working" || status === "invalid_submission") return "destructive" as const;
  return "secondary" as const;
}

export function ReviewedProjectsTab() {
  const [filters, setFilters] = useState<ReviewedFilters>(EMPTY_REVIEWED_FILTERS);
  const [page, setPage] = useState(0);
  const { rows, options, loading, error, refetch } = useReviewedProjects(filters);

  const update = (next: Partial<ReviewedFilters>) => {
    setPage(0);
    setFilters((f) => ({ ...f, ...next }));
  };

  const pageRows = useMemo(
    () => rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [rows, page],
  );

  const kpis = useMemo(() => {
    const fully = rows.filter((r) => r.status === "fully_working").length;
    const failed = rows.filter(
      (r) => r.status === "not_working" || r.status === "invalid_submission",
    ).length;
    const points = rows.reduce((s, r) => s + (Number(r.points) || 0), 0);
    return {
      total: rows.length,
      fully,
      failed,
      pending: rows.filter((r) => r.status === "pending").length,
      avg: rows.length ? (points / rows.length).toFixed(2) : "—",
    };
  }, [rows]);

  const exportCsv = () => {
    downloadCsv(
      "reviewed-projects",
      [
        "Project ID",
        "Title",
        "Student",
        "Student ID",
        "Tutor",
        "Tutor ID",
        "Team leader",
        "Result",
        "Points",
        "Reviewer",
        "Reviewed on",
        "Note",
        "Evidence",
      ],
      rows.map((r) => [
        r.project_id,
        r.project_title ?? "",
        r.student_name ?? "",
        (r as any).student_external_id ?? "",
        r.tutor_name ?? "",
        r.tutor_external_id ?? "",
        r.team_leader ?? "",
        statusShortLabel(r.status),
        r.points,
        r.reviewed_by_name ?? "",
        new Date(r.created_at).toLocaleString(),
        r.note ?? "",
        r.evidence_url ?? "",
      ]),
    );
  };

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
          />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Reviewed projects", value: kpis.total },
          { label: "Fully working", value: kpis.fully },
          { label: "Not working / invalid", value: kpis.failed },
          { label: "Pending recheck", value: kpis.pending },
          { label: "Average points", value: kpis.avg },
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

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Reviewed projects
            {loading && <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Team leader</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Reviewed on</TableHead>
                  <TableHead>Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium max-w-[220px] truncate">
                      {r.project_title || `Project ${r.project_id}`}
                      <span className="block text-xs text-muted-foreground">#{r.project_id}</span>
                    </TableCell>
                    <TableCell>
                      {r.student_name ?? "—"}
                      <span className="block text-xs text-muted-foreground">
                        {(r as any).student_external_id ?? ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.tutor_name ?? "—"}
                      <span className="block text-xs text-muted-foreground">{r.tutor_external_id ?? ""}</span>
                    </TableCell>
                    <TableCell>{r.team_leader ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{statusShortLabel(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.points}</TableCell>
                    <TableCell>{r.reviewed_by_name ?? "—"}</TableCell>
                    <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="max-w-[160px] truncate">
                      {r.evidence_url ? (
                        <a
                          href={r.evidence_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No reviewed projects match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {page + 1} — {rows.length} reviewed projects
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * PAGE_SIZE >= rows.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
