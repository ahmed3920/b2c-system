import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, Download } from "lucide-react";
import { runReplicaQuery } from "@/hooks/useReplicaQuery";
import { PAGE_SIZE } from "@/hooks/useQualityReviews";
import { useQualityObjections, STAGE_LABEL, ROLE_LABEL, type ObjectionRow } from "@/hooks/useQualityObjections";
import { QualityFilterBar, Field, Kpi, downloadCsv } from "./QualityFilterBar";
import { QualityObjectionDetailDialog, OutcomeBadge } from "./QualityObjectionDetailDialog";
import { toast } from "@/hooks/use-toast";
import { cycleLabel } from "@/lib/tutorStatus";

const ALL = "all";

const STAGES = [
  "pending_tl",
  "pending_qc",
  "pending_qtl",
  "pending_edit",
  "pending_qtl_confirm",
  "accepted",
  "rejected_tl",
  "rejected_qtl",
];

export function QualityObjectionsTab() {
  const f = useQualityObjections();
  const [selected, setSelected] = useState<ObjectionRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const s = f.summary;
  const total = s?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await runReplicaQuery<Record<string, unknown>>("quality_objections_list", {
        ...f.objParams,
        limit: 2000,
        offset: 0,
      });
      const mapped = rows.map((r) => ({ ...r, stage: STAGE_LABEL[String(r.stage)] ?? r.stage }));
      if (!downloadCsv(`quality-objections-${new Date().toISOString().slice(0, 10)}.csv`, mapped)) {
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
        <Kpi label="Objections" value={total.toLocaleString()} loading={f.summaryLoading} />
        <Kpi label="Still open" value={(s?.pending ?? 0).toLocaleString()} loading={f.summaryLoading} />
        <Kpi label="Accepted" value={(s?.accepted ?? 0).toLocaleString()} loading={f.summaryLoading} />
        <Kpi label="Rejected" value={(s?.rejected ?? 0).toLocaleString()} loading={f.summaryLoading} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Waiting on Team Leader"
          value={(s?.pending_tl ?? 0).toLocaleString()}
          loading={f.summaryLoading}
          hint={s ? `From ${(s.pending_tl_tutors ?? 0).toLocaleString()} tutors · ${(s.pending_tl_reviews ?? 0).toLocaleString()} reviews` : undefined}
        />
        <Kpi
          label="Waiting on Quality Coordinator"
          value={(s?.pending_qc ?? 0).toLocaleString()}
          loading={f.summaryLoading}
          hint={s ? `From ${(s.pending_qc_tutors ?? 0).toLocaleString()} tutors · ${(s.pending_qc_reviews ?? 0).toLocaleString()} reviews` : undefined}
        />
        <Kpi
          label="Waiting on Quality Team Leader"
          value={(s?.pending_qtl ?? 0).toLocaleString()}
          loading={f.summaryLoading}
          hint={s ? `From ${(s.pending_qtl_tutors ?? 0).toLocaleString()} tutors · ${(s.pending_qtl_reviews ?? 0).toLocaleString()} reviews` : undefined}
        />
        <Kpi label="Comments / flags removed" value={(s?.items_removed ?? 0).toLocaleString()} loading={f.summaryLoading} />

      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Reviews with objections" value={(s?.reviews ?? 0).toLocaleString()} loading={f.summaryLoading} />
        <Kpi label="Tutors with objections" value={(s?.tutors ?? 0).toLocaleString()} loading={f.summaryLoading} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          label="Avg wait — Team Leader"
          value={s?.pending_tl_avg_days != null ? `${s.pending_tl_avg_days} days` : "—"}
          loading={f.summaryLoading}
          hint={
            s
              ? `${(s.pending_tl_overdue ?? 0).toLocaleString()} of ${(s.pending_tl ?? 0).toLocaleString()} overdue · ${(s.pending_tl_tutors ?? 0).toLocaleString()} tutors · ${(s.pending_tl_reviews ?? 0).toLocaleString()} reviews`
              : undefined
          }
          tooltip="Average of (today − the date the objection was raised), counted only for objections still waiting on the team leader. Overdue = those whose team-leader deadline has already passed. Follows the filters set below."
        />
        <Kpi
          label="Avg wait — Quality Coordinator"
          value={s?.pending_qc_avg_days != null ? `${s.pending_qc_avg_days} days` : "—"}
          loading={f.summaryLoading}
          hint={
            s
              ? `${(s.pending_qc_overdue ?? 0).toLocaleString()} of ${(s.pending_qc ?? 0).toLocaleString()} overdue · ${(s.pending_qc_tutors ?? 0).toLocaleString()} tutors · ${(s.pending_qc_reviews ?? 0).toLocaleString()} reviews`
              : undefined
          }
          tooltip="Average of (today − the date the objection was raised), counted only for objections still waiting on the quality coordinator. Overdue = those whose quality-coordinator deadline has already passed. Follows the filters set below."
        />
        <Kpi
          label="Avg wait — Quality Team Leader"
          value={s?.pending_qtl_avg_days != null ? `${s.pending_qtl_avg_days} days` : "—"}
          loading={f.summaryLoading}
          hint={
            s
              ? `${(s.pending_qtl_overdue ?? 0).toLocaleString()} of ${(s.pending_qtl ?? 0).toLocaleString()} overdue · ${(s.pending_qtl_tutors ?? 0).toLocaleString()} tutors · ${(s.pending_qtl_reviews ?? 0).toLocaleString()} reviews`
              : undefined
          }
          tooltip="Average of (today − the date the objection was raised), counted only for objections still waiting on the quality team leader — including those waiting for the review edit and for the final confirmation. Overdue = those whose quality-team-leader deadline has already passed. Follows the filters set below."
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          label="Team Leader decisions"
          value={s ? `${(s.tl_accepted ?? 0).toLocaleString()} accepted` : "—"}
          loading={f.summaryLoading}
          hint={s ? `${(s.tl_rejected ?? 0).toLocaleString()} rejected` : undefined}
          tooltip="How many objections the educational team leader agreed to remove, and how many they turned down. One objection can be decided by more than one role, so these cards are not a split of the total."
        />
        <Kpi
          label="Quality Coordinator decisions"
          value={s ? `${(s.qc_accepted ?? 0).toLocaleString()} accepted` : "—"}
          loading={f.summaryLoading}
          hint={s ? `${(s.qc_rejected ?? 0).toLocaleString()} rejected` : undefined}
          tooltip="How many objections the quality coordinator agreed to remove, and how many they turned down. One objection can be decided by more than one role, so these cards are not a split of the total."
        />
        <Kpi
          label="Quality Team Leader decisions"
          value={s ? `${(s.qtl_accepted ?? 0).toLocaleString()} accepted` : "—"}
          loading={f.summaryLoading}
          hint={s ? `${(s.qtl_rejected ?? 0).toLocaleString()} rejected` : undefined}
          tooltip="How many objections the quality team leader accepted to remove, and how many they rejected. One objection can be decided by more than one role, so these cards are not a split of the total."
        />
      </div>

      <QualityFilterBar
        filters={f.filters}
        update={f.update}
        reset={() => {
          f.reset();
          f.setStage("");
          f.setOutcome("");
          f.setSearch("");
        }}
        options={f.options}
        onRefresh={f.refetch}
        loading={f.loading}
        actions={
          <Button size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            Export CSV
          </Button>
        }
      >
        <Field label="Stage">
          <Select value={f.stage || ALL} onValueChange={(v) => { f.setPage(0); f.setStage(v === ALL ? "" : v); }}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL}>All stages</SelectItem>
              {STAGES.map((x) => (
                <SelectItem key={x} value={x}>{STAGE_LABEL[x]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Outcome">
          <Select value={f.outcome || ALL} onValueChange={(v) => { f.setPage(0); f.setOutcome(v === ALL ? "" : v); }}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All outcomes</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Search text">
          <Input
            placeholder="tutor, comment or argument"
            value={f.search}
            onChange={(e) => { f.setPage(0); f.setSearch(e.target.value); }}
          />
        </Field>
      </QualityFilterBar>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Objections{" "}
            <span className="text-sm font-normal text-muted-foreground">
              showing {f.rows.length} of {total.toLocaleString()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {f.error ? (
            <p className="text-destructive text-sm flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5" /> {f.error}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Raised</TableHead>
                      <TableHead>Tutor</TableHead>
                      <TableHead>Objected item</TableHead>
                      <TableHead>Now with</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Last action by</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {f.loading && f.rows.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading objections…</TableCell></TableRow>
                    ) : f.rows.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No objections match these filters.</TableCell></TableRow>
                    ) : (
                      f.rows.map((r) => (
                        <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                            {r.review_cycle && <span className="block text-xs text-muted-foreground">{cycleLabel(r.review_cycle)}</span>}
                          </TableCell>
                          <TableCell>
                            {r.tutor_name}
                            <span className="block text-xs text-muted-foreground">{r.tutor_tid} · {r.team_leader ?? "—"}</span>
                          </TableCell>
                          <TableCell className="max-w-[320px]">
                            <Badge variant="outline" className="mb-1">{r.item_kind ?? r.objectionable_type}</Badge>
                            <span className="block text-xs text-muted-foreground line-clamp-2">{r.item_text ?? "—"}</span>
                            {r.item_removed && <span className="block text-xs text-emerald-700">removed from review</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {STAGE_LABEL[r.stage] ?? r.stage}
                            {r.outcome === "pending" && r.days_waiting != null && (
                              <span className="block text-xs text-muted-foreground">{Number(r.days_waiting).toFixed(1)} days</span>
                            )}
                          </TableCell>
                          <TableCell><OutcomeBadge outcome={r.outcome} /></TableCell>
                          <TableCell className="text-sm">
                            {r.last_actor_name ?? "—"}
                            <span className="block text-xs text-muted-foreground">{ROLE_LABEL[r.last_actor_role ?? "system"] ?? "—"}</span>
                          </TableCell>
                          <TableCell className="text-right font-medium">{r.score != null ? Number(r.score).toFixed(2) : "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between pt-3 text-sm">
                <span className="text-muted-foreground">Page {f.page + 1} of {pages}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={f.page === 0 || f.loading} onClick={() => f.setPage(f.page - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={f.page + 1 >= pages || f.loading} onClick={() => f.setPage(f.page + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">By team leader</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team leader</TableHead>
                  <TableHead className="text-right">Objections</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Accepted</TableHead>
                  <TableHead className="text-right">Rejected</TableHead>
                  <TableHead className="text-right">Accept rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {f.teamLeadersLoading && f.teamLeaders.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : f.teamLeaders.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No data.</TableCell></TableRow>
                ) : (
                  f.teamLeaders.map((t) => {
                    const decided = t.accepted + t.rejected;
                    const rate = decided ? Math.round((t.accepted / decided) * 100) : 0;
                    return (
                      <TableRow key={t.team_leader}>
                        <TableCell>{t.team_leader}</TableCell>
                        <TableCell className="text-right">{t.total}</TableCell>
                        <TableCell className="text-right">{t.pending}</TableCell>
                        <TableCell className="text-right">{t.accepted}</TableCell>
                        <TableCell className="text-right">{t.rejected}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={rate >= 50 ? "destructive" : "secondary"}>{rate}%</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <QualityObjectionDetailDialog objection={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
