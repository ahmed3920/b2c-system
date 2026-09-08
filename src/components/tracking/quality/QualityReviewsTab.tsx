import { useState } from "react";
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
import { useQualityReviews, statusLabel, PAGE_SIZE } from "@/hooks/useQualityReviews";
import { QualityReviewDetailDialog } from "./QualityReviewDetailDialog";
import { QualityReviewsInsights } from "./QualityReviewsInsights";
import { QualityFilterBar, Kpi, downloadCsv } from "./QualityFilterBar";
import { runReplicaQuery } from "@/hooks/useReplicaQuery";
import { toast } from "@/hooks/use-toast";
import { tutorStatusLabel, cycleLabel } from "@/lib/tutorStatus";

export function QualityReviewsTab() {
  const q = useQualityReviews();
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const total = q.summary?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await runReplicaQuery<Record<string, unknown>>("quality_reviews_list", {
        ...q.baseParams,
        limit: 2000,
        offset: 0,
      });
      const mapped = rows.map((r) => ({ ...r, tutor_status: tutorStatusLabel(r.tutor_status as number) }));
      if (!downloadCsv(`quality-reviews-${new Date().toISOString().slice(0, 10)}.csv`, mapped)) {
        toast({ title: "Nothing to export" });
      }
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Reviews" value={total.toLocaleString()} loading={q.summaryLoading} />
        <Kpi
          label="Average score"
          value={q.summary?.avg_score ? `${Number(q.summary.avg_score).toFixed(2)} / 5` : "—"}
          loading={q.summaryLoading}
        />
        <Kpi
          label="Immediate action"
          value={(q.summary?.needs_immediate_action ?? 0).toLocaleString()}
          loading={q.summaryLoading}
        />
        <Kpi label="Tutors reviewed" value={(q.summary?.tutors ?? 0).toLocaleString()} loading={q.summaryLoading} />
      </div>

      <QualityFilterBar
        filters={q.filters}
        update={q.update}
        reset={q.reset}
        options={q.options}
        onRefresh={q.refetch}
        loading={q.loading}
        actions={
          <Button size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-1.5" />
            )}
            Export CSV
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Session reviews{" "}
            <span className="text-sm font-normal text-muted-foreground">
              showing {q.rows.length} of {total.toLocaleString()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {q.error ? (
            <p className="text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              {q.error}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Tutor</TableHead>
                      <TableHead>Tutor status</TableHead>
                      <TableHead>Team leader</TableHead>
                      <TableHead>Lesson</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Cycle</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.loading && q.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          Loading reviews…
                        </TableCell>
                      </TableRow>
                    ) : q.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          No reviews match these filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      q.rows.map((r) => (
                        <TableRow
                          key={r.id}
                          className="cursor-pointer"
                          onClick={() => setSelected(r.id)}
                        >
                          <TableCell className="whitespace-nowrap">
                            {r.session_start_at
                              ? new Date(r.session_start_at).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {r.tutor_name}
                            <span className="block text-xs text-muted-foreground">{r.tutor_tid}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.tutor_status === 0 ? "secondary" : "outline"}>
                              {tutorStatusLabel(r.tutor_status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{r.team_leader ?? "—"}</TableCell>
                          <TableCell className="text-sm max-w-[220px] truncate">
                            {r.lesson_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">{r.session_type}</TableCell>
                          <TableCell className="text-sm">
                            {cycleLabel(r.review_cycle)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {r.score != null ? Number(r.score).toFixed(2) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.status === "1" ? "secondary" : "outline"}>
                              {statusLabel(r.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {r.needs_immediate_action && (
                                <Badge variant="destructive">Action</Badge>
                              )}
                              {r.needs_coaching && <Badge variant="destructive">Coaching</Badge>}
                              {r.has_pending_objections && <Badge variant="outline">Objection</Badge>}
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
                <span className="text-muted-foreground">
                  Page {q.page + 1} of {pages}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={q.page === 0 || q.loading}
                    onClick={() => q.setPage(q.page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={q.page + 1 >= pages || q.loading}
                    onClick={() => q.setPage(q.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <QualityReviewsInsights params={q.baseParams} />

      <QualityReviewDetailDialog
        reviewId={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
