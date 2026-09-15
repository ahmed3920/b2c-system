import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw } from "lucide-react";
import { runReplicaQuery } from "@/hooks/useReplicaQuery";
import { useEvaluations, useMyAssignments } from "@/hooks/useProjectReviews";
import { statusShortLabel } from "@/lib/projectEvaluation";
import { ProjectDetailDialog } from "./ProjectDetailDialog";
import type { ProjectRow } from "@/hooks/useProjectAudit";

/** Today's randomly assigned projects for the signed-in reviewer. */
export function MyReviewsTab() {
  const { rows, open, doneToday, loading, refetch } = useMyAssignments();
  const ids = useMemo(() => rows.map((r) => Number(r.project_id)), [rows]);
  const { evaluations, refetch: refetchEvaluations } = useEvaluations(ids);
  const [detail, setDetail] = useState<ProjectRow | null>(null);
  const [opening, setOpening] = useState<number | null>(null);

  const openProject = async (projectId: number) => {
    setOpening(projectId);
    try {
      const found = await runReplicaQuery<ProjectRow>("project_audit_by_id", { project_id: projectId });
      setDetail(found[0] ?? null);
    } finally {
      setOpening(null);
    }
  };


  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Open today", value: open.length },
          { label: "Completed today", value: doneToday.length },
          { label: "Total assigned", value: rows.length },
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
            My review queue {loading && <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Team leader</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => {
                  const e = evaluations[Number(a.project_id)];
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium max-w-[220px] truncate">
                        {a.project_title || `Project ${a.project_id}`}
                      </TableCell>
                      <TableCell>
                        {a.student_name}
                        <span className="block text-xs text-muted-foreground">{a.student_external_id}</span>
                      </TableCell>
                      <TableCell>{a.tutor_name ?? "—"}</TableCell>
                      <TableCell>{a.team_leader ?? "—"}</TableCell>
                      <TableCell>{new Date(a.assigned_on).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={e ? (e.status === "fully_working" ? "default" : "secondary") : "outline"}>
                          {statusShortLabel(e?.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={opening === Number(a.project_id)}
                          onClick={() => openProject(Number(a.project_id))}
                        >
                          {opening === Number(a.project_id) && (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          )}
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nothing assigned to you yet. New projects arrive each day.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ProjectDetailDialog
        project={detail}
        evaluation={detail ? evaluations[Number(detail.project_id)] : undefined}
        onClose={() => setDetail(null)}
        onEvaluated={() => {
          refetchEvaluations();
          refetch();
        }}
      />
    </div>
  );
}
