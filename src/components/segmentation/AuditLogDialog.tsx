import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface AuditRow {
  id: string;
  event_type: string;
  actor_name: string | null;
  tutor_name: string | null;
  tutor_external_id: string | null;
  team_leader: string | null;
  before_data: any;
  after_data: any;
  context: any;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const EVENT_LABEL: Record<string, string> = {
  recompute: "Recompute",
  manual_rating_insert: "Rating added",
  manual_rating_update: "Rating updated",
  manual_rating_delete: "Rating removed",
};

const EVENT_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  recompute: "default",
  manual_rating_insert: "secondary",
  manual_rating_update: "secondary",
  manual_rating_delete: "destructive",
};

function ratingDiff(before: any, after: any): string {
  const keys = ["communication", "tl_feedback", "culture_fit", "parent_handling", "note"];
  const parts: string[] = [];
  for (const k of keys) {
    const b = before?.[k] ?? null;
    const a = after?.[k] ?? null;
    if (String(b ?? "") !== String(a ?? "")) parts.push(`${k}: ${b ?? "—"} → ${a ?? "—"}`);
  }
  return parts.join(", ");
}

export function AuditLogDialog({ open, onOpenChange }: Props) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tutor_segmentation_audit" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows(((data as any[]) ?? []) as AuditRow[]);
      setLoading(false);
    })();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Segmentation Audit Log</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="text-sm text-muted-foreground">No audit entries yet.</div>
        )}

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded border p-3 text-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant={EVENT_VARIANT[r.event_type] ?? "outline"}>
                    {EVENT_LABEL[r.event_type] ?? r.event_type}
                  </Badge>
                  <span className="font-medium">{r.actor_name ?? "Unknown user"}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(r.created_at), "PPpp")}
                </span>
              </div>

              {r.tutor_name && (
                <div className="text-xs mt-1">
                  <span className="text-muted-foreground">Tutor:</span> {r.tutor_name}
                  {r.tutor_external_id && <span className="font-mono ml-1">({r.tutor_external_id})</span>}
                  {r.team_leader && <span className="text-muted-foreground"> · TL {r.team_leader}</span>}
                </div>
              )}

              {r.event_type === "recompute" && r.context && (
                <div className="text-xs mt-1 text-muted-foreground">
                  {r.context.tutors_scored != null && <>Scored {r.context.tutors_scored} tutors · </>}
                  {r.context.recommendations_generated != null && <>{r.context.recommendations_generated} recs · </>}
                  {r.context.snapshot_date && <>Snapshot {r.context.snapshot_date}</>}
                  {r.context.context && Object.keys(r.context.context).length > 0 && (
                    <div className="mt-1">Filters: <code>{JSON.stringify(r.context.context)}</code></div>
                  )}
                </div>
              )}

              {r.event_type === "manual_rating_update" && (
                <div className="text-xs mt-1">
                  <span className="text-muted-foreground">Changes:</span> {ratingDiff(r.before_data, r.after_data) || "no measurable diff"}
                </div>
              )}
              {r.event_type === "manual_rating_insert" && r.after_data && (
                <div className="text-xs mt-1">
                  <span className="text-muted-foreground">Set:</span> {ratingDiff({}, r.after_data)}
                </div>
              )}
              {r.event_type === "manual_rating_delete" && r.before_data && (
                <div className="text-xs mt-1">
                  <span className="text-muted-foreground">Previous:</span> {ratingDiff({}, r.before_data)}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
