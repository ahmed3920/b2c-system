import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface AuditEntry {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_name: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticketId: string | null;
  ticketNumber: string | null;
}

export function CSTicketAuditDialog({ open, onOpenChange, ticketId, ticketNumber }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !ticketId) return;
    setLoading(true);
    supabase
      .from("cs_ticket_audit")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEntries((data ?? []) as AuditEntry[]);
        setLoading(false);
      });
  }, [open, ticketId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change history — {ticketNumber}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No changes recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="border rounded-md p-3 text-sm">
                <div className="flex justify-between gap-2 mb-1">
                  <span className="font-medium capitalize">{e.field_name.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(e.created_at), "PP p")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  by {e.changed_by_name ?? "Unknown"}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">From</div>
                    <div className="font-mono break-all whitespace-pre-wrap">
                      {e.old_value || <span className="italic">empty</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">To</div>
                    <div className="font-mono break-all whitespace-pre-wrap">
                      {e.new_value || <span className="italic">empty</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
