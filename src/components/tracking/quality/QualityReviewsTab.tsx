import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, AlertTriangle, Download, X } from "lucide-react";
import { useQualityReviews, statusLabel, PAGE_SIZE } from "@/hooks/useQualityReviews";
import { QualityReviewDetailDialog } from "./QualityReviewDetailDialog";
import { QualityReviewsInsights } from "./QualityReviewsInsights";
import { runReplicaQuery } from "@/hooks/useReplicaQuery";
import { toast } from "@/hooks/use-toast";

const ALL = "all";

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
      if (!rows.length) {
        toast({ title: "Nothing to export" });
        return;
      }
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(","),
        ...rows.map((r) =>
          headers
            .map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`)
            .join(","),
        ),
      ].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `quality-reviews-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
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

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Filters</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={q.reset}>
              <X className="w-3.5 h-3.5 mr-1.5" /> Clear
            </Button>
            <Button size="sm" variant="outline" onClick={q.refetch} disabled={q.loading}>
              {q.loading ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Refresh
            </Button>
            <Button size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="From">
            <Input
              type="date"
              value={q.filters.date_from}
              onChange={(e) => q.update({ date_from: e.target.value })}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={q.filters.date_to}
              onChange={(e) => q.update({ date_to: e.target.value })}
            />
          </Field>
          <Field label="Team leader">
            <Select
              value={q.filters.team_lead || ALL}
              onValueChange={(v) => q.update({ team_lead: v === ALL ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ALL}>All team leaders</SelectItem>
                {(q.options?.team_leaders ?? []).map((tl) => (
                  <SelectItem key={tl} value={tl}>
                    {tl}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tutor name or T-ID">
            <Input
              placeholder="e.g. T-4602"
              value={q.filters.tutor}
              onChange={(e) => q.update({ tutor: e.target.value })}
            />
          </Field>
          <Field label="Session type">
            <Select
              value={q.filters.session_type || ALL}
              onValueChange={(v) => q.update({ session_type: v === ALL ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {(q.options?.session_types ?? []).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Review cycle">
            <Select
              value={q.filters.review_cycle || ALL}
              onValueChange={(v) => q.update({ review_cycle: v === ALL ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ALL}>All cycles</SelectItem>
                {(q.options?.review_cycles ?? []).map((c) => (
                  <SelectItem key={c} value={c}>
                    Cycle {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={q.filters.status || ALL}
              onValueChange={(v) => q.update({ status: v === ALL ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="1">Submitted</SelectItem>
                <SelectItem value="0">Pending</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Min score">
            <Input
              type="number"
              step="0.1"
              min={0}
              max={5}
              value={q.filters.min_score}
              onChange={(e) => q.update({ min_score: e.target.value })}
            />
          </Field>
          <Field label="Max score">
            <Input
              type="number"
              step="0.1"
              min={0}
              max={5}
              value={q.filters.max_score}
              onChange={(e) => q.update({ max_score: e.target.value })}
            />
          </Field>
        </CardContent>
      </Card>

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
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Loading reviews…
                        </TableCell>
                      </TableRow>
                    ) : q.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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
                          <TableCell className="text-sm">{r.team_leader ?? "—"}</TableCell>
                          <TableCell className="text-sm max-w-[220px] truncate">
                            {r.lesson_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">{r.session_type}</TableCell>
                          <TableCell className="text-sm">
                            {r.review_cycle != null ? `Cycle ${r.review_cycle}` : "—"}
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

function Kpi({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{loading ? "…" : value}</p>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
