import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, AlertTriangle, Download } from "lucide-react";
import { useQualityFilters, PAGE_SIZE, type QualitySummary } from "@/hooks/useQualityReviews";
import { runReplicaQuery, useReplicaQuery } from "@/hooks/useReplicaQuery";
import { QualityReviewDetailDialog } from "./QualityReviewDetailDialog";
import { QualityFilterBar, Kpi, downloadCsv } from "./QualityFilterBar";
import { toast } from "@/hooks/use-toast";
import { tutorStatusLabel, cycleLabel } from "@/lib/tutorStatus";

type SessionRow = {
  id: string;
  score: string | null;
  status: string | null;
  session_type: string | null;
  session_start_at: string | null;
  duration: number | null;
  review_cycle: string | number | null;
  needs_coaching: boolean;
  needs_immediate_action: boolean;
  remarkable_session: boolean;
  has_flags: boolean;
  tutor_tid: string | null;
  tutor_name: string | null;
  tutor_status: number | null;
  team_leader: string | null;
  mentor_name: string | null;
  lesson_name: string | null;
  lesson_position: number | null;
  student_sid: string | null;
  tutor_join_time: string | null;
  student_join_time: string | null;
  student_feedback: number | null;
  student_feedback_comment: string | null;
  is_student_absent: boolean | null;
};

const time = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

export function QualitySessionDetailsTab({
  openReviewId,
  onOpenedReview,
}: {
  openReviewId?: string | null;
  onOpenedReview?: () => void;
}) {
  const f = useQualityFilters();
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Deep link from a notification: open the requested review directly.
  useEffect(() => {
    if (openReviewId) {
      setSelected(openReviewId);
      onOpenedReview?.();
    }
  }, [openReviewId, onOpenedReview]);

  const listParams = useMemo(
    () => ({ ...f.baseParams, limit: PAGE_SIZE, offset: f.page * PAGE_SIZE }),
    [f.baseParams, f.page],
  );
  const list = useReplicaQuery<SessionRow>("quality_session_details", listParams);
  const summary = useReplicaQuery<QualitySummary>("quality_reviews_count", f.baseParams);
  const total = summary.rows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await runReplicaQuery<Record<string, unknown>>("quality_session_details", {
        ...f.baseParams,
        limit: 2000,
        offset: 0,
      });
      const mapped = rows.map((r) => ({ ...r, tutor_status: tutorStatusLabel(r.tutor_status as number) }));
      if (!downloadCsv(`quality-sessions-${new Date().toISOString().slice(0, 10)}.csv`, mapped)) {
        toast({ title: "Nothing to export" });
      }
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Reviewed sessions" value={total.toLocaleString()} loading={summary.loading} />
        <Kpi
          label="Average score"
          value={summary.rows[0]?.avg_score ? `${Number(summary.rows[0].avg_score).toFixed(2)} / 5` : "—"}
          loading={summary.loading}
        />
        <Kpi label="Flagged" value={(summary.rows[0]?.flagged ?? 0).toLocaleString()} loading={summary.loading} />
        <Kpi label="Remarkable" value={(summary.rows[0]?.remarkable ?? 0).toLocaleString()} loading={summary.loading} />
      </div>

      <QualityFilterBar
        filters={f.filters}
        update={f.update}
        reset={f.reset}
        options={f.options}
        onRefresh={() => {
          list.refetch();
          summary.refetch();
        }}
        loading={list.loading}
        actions={
          <Button size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            Export CSV
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Session details{" "}
            <span className="text-sm font-normal text-muted-foreground">
              showing {list.rows.length} of {total.toLocaleString()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.error ? (
            <p className="text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" /> {list.error}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Tutor</TableHead>
                      <TableHead>Team leader / Mentor</TableHead>
                      <TableHead>Lesson</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Joined (tutor / student)</TableHead>
                      <TableHead>Student feedback</TableHead>
                      <TableHead>Cycle</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.loading && list.rows.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Loading sessions…</TableCell></TableRow>
                    ) : list.rows.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No sessions match these filters.</TableCell></TableRow>
                    ) : (
                      list.rows.map((r) => (
                        <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r.id)}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {r.session_start_at ? new Date(r.session_start_at).toLocaleString() : "—"}
                            <span className="block text-xs text-muted-foreground">
                              {r.session_type}{r.duration ? ` · ${r.duration} min` : ""}
                            </span>
                          </TableCell>
                          <TableCell>
                            {r.tutor_name}
                            <span className="block text-xs text-muted-foreground">
                              {r.tutor_tid} · {tutorStatusLabel(r.tutor_status)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.team_leader ?? "—"}
                            <span className="block text-xs text-muted-foreground">{r.mentor_name ?? "No mentor"}</span>
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {r.lesson_name ?? "—"}
                            {r.lesson_position != null && (
                              <span className="block text-xs text-muted-foreground">Lesson #{r.lesson_position}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.student_sid ?? "—"}
                            {r.is_student_absent && <Badge variant="outline" className="ml-1">Absent</Badge>}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {time(r.tutor_join_time)} / {time(r.student_join_time)}
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px]">
                            {r.student_feedback != null ? `${r.student_feedback} / 5` : "—"}
                            {r.student_feedback_comment && (
                              <span className="block text-xs text-muted-foreground truncate">{r.student_feedback_comment}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{cycleLabel(r.review_cycle)}</TableCell>
                          <TableCell className="text-right font-medium">{r.score != null ? Number(r.score).toFixed(2) : "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {r.needs_immediate_action && <Badge variant="destructive">Action</Badge>}
                              {r.needs_coaching && <Badge variant="destructive">Coaching</Badge>}
                              {r.remarkable_session && <Badge>Remarkable</Badge>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between pt-3 text-sm">
                <span className="text-muted-foreground">Page {f.page + 1} of {pages}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={f.page === 0 || list.loading} onClick={() => f.setPage(f.page - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={f.page + 1 >= pages || list.loading} onClick={() => f.setPage(f.page + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <QualityReviewDetailDialog reviewId={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
