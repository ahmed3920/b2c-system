import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useReplicaQuery } from "@/hooks/useReplicaQuery";
import { ROLE_LABEL, STAGE_LABEL, type ObjectionRow } from "@/hooks/useQualityObjections";

type TimelineRow = {
  id: string;
  action: number;
  log: string | null;
  meta: Record<string, string> | null;
  owner_type: string | null;
  created_at: string | null;
  actor_name: string | null;
  actor_role: string | null;
  response_status: number | null;
  response_text: string | null;
};

type SiblingRow = {
  id: string;
  stage: string;
  outcome: string;
  item_kind: string | null;
  item_text: string | null;
  item_removed: boolean;
};

/** Rails logs are templates like "Quality Coordinator %{admin_name} Rejected ..." */
function renderLog(log: string | null, meta: Record<string, string> | null) {
  if (!log) return "—";
  return log.replace(/%\{(\w+)\}/g, (_, k) => (meta && meta[k]) || "—");
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString() : "—";
}

export function OutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === "accepted")
    return <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Accepted</Badge>;
  if (outcome === "rejected")
    return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
  return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
}

export function QualityObjectionDetailDialog({
  objection,
  onOpenChange,
}: {
  objection: ObjectionRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const id = objection?.id ?? null;
  const timeline = useReplicaQuery<TimelineRow>(
    "quality_objection_timeline",
    { objection_id: id },
    { enabled: !!id },
  );
  const sla = useReplicaQuery<SlaRow>(
    "quality_objection_sla",
    { objection_id: id },
    { enabled: !!id },
  );
  const siblings = useReplicaQuery<SiblingRow>(
    "quality_objections_by_review",
    { review_id: objection?.review_id ?? null },
    { enabled: !!objection?.review_id },
  );

  return (
    <Dialog open={!!objection} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Objection #{objection?.id}
            {objection && <OutcomeBadge outcome={objection.outcome} />}
            {objection && <Badge variant="secondary">{STAGE_LABEL[objection.stage] ?? objection.stage}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {objection && (
          <div className="space-y-5 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Tutor" value={`${objection.tutor_name ?? "—"} (${objection.tutor_tid ?? "—"})`} />
              <Info label="Team leader" value={objection.team_leader ?? "—"} />
              <Info label="Reviewer" value={objection.reviewer_name ?? "—"} />
              <Info label="Session date" value={objection.session_start_at ? new Date(objection.session_start_at).toLocaleDateString() : "—"} />
              <Info label="Raised on" value={fmt(objection.created_at)} />
              <Info label="Resolved on" value={fmt(objection.resolution_date)} />
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-1">Objected item</h4>
              <Badge variant="outline" className="mb-2">{objection.item_kind ?? objection.objectionable_type}</Badge>
              <p className="whitespace-pre-wrap text-muted-foreground">{objection.item_text ?? "—"}</p>
              <p className="mt-2">
                {objection.item_removed ? (
                  <span className="text-emerald-700">This item was removed from the review.</span>
                ) : (
                  <span className="text-muted-foreground">This item is still on the review.</span>
                )}
              </p>
            </div>

            <div>
              <h4 className="font-medium mb-1">Tutor's argument</h4>
              <p className="whitespace-pre-wrap text-muted-foreground">{objection.description ?? "—"}</p>
            </div>

            {objection.response && (
              <div>
                <h4 className="font-medium mb-1">Latest reply</h4>
                <p className="whitespace-pre-wrap text-muted-foreground">{objection.response}</p>
              </div>
            )}

            <Separator />

            <div>
              <h4 className="font-medium mb-2">Score</h4>
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-2xl font-semibold">{objection.score != null ? Number(objection.score).toFixed(2) : "—"}</div>
                  <div className="text-xs text-muted-foreground">current review score ({objection.score_pct ?? "—"}%)</div>
                </div>
                <div className="text-muted-foreground">
                  {objection.outcome === "accepted"
                    ? "The review was edited after this objection, so the score above already includes the change."
                    : objection.outcome === "rejected"
                      ? "The objection was rejected — the score was left unchanged."
                      : "Still open — the score can still change."}
                </div>
              </div>
              {siblings.rows.length > 1 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Other objections on the same review:</p>
                  {siblings.rows
                    .filter((s) => s.id !== objection.id)
                    .map((s) => (
                      <div key={s.id} className="flex items-start gap-2">
                        <OutcomeBadge outcome={s.outcome} />
                        <span className="text-muted-foreground">
                          {s.item_kind} — {s.item_removed ? "removed" : "kept"}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">Handling chain</h4>
              {timeline.loading && timeline.rows.length === 0 ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : timeline.rows.length === 0 ? (
                <p className="text-muted-foreground">No history recorded.</p>
              ) : (
                <ol className="space-y-3 border-l pl-4">
                  {timeline.rows.map((t) => (
                    <li key={t.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{ROLE_LABEL[t.actor_role ?? "system"] ?? t.actor_role}</Badge>
                        <span className="font-medium">{t.actor_name ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">{fmt(t.created_at)}</span>
                      </div>
                      <p className="text-muted-foreground">{renderLog(t.log, t.meta)}</p>
                      {t.response_text && <p className="mt-1 whitespace-pre-wrap">{t.response_text}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
