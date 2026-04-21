import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { STATUS_OPTIONS, type CSTicketStatus } from "./csTicketCategories";
import type { CSTicket } from "./useCSTickets";

interface Props {
  ticket: CSTicket | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated?: () => void;
}

export function CSTicketDetailDialog({ ticket, open, onOpenChange, onUpdated }: Props) {
  const [status, setStatus] = useState<CSTicketStatus>("Pending");
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status);
      setResponse(ticket.team_leader_response ?? "");
    }
  }, [ticket]);

  if (!ticket) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("cs_tickets")
        .update({ status, team_leader_response: response || null })
        .eq("id", ticket.id);
      if (error) throw error;
      toast({ title: "Ticket updated" });
      onOpenChange(false);
      onUpdated?.();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ticket.ticket_number}
            <Badge variant={ticket.case_type === "CS" ? "default" : "secondary"}>{ticket.case_type}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ticket Date" value={ticket.ticket_date} />
            <Field label="Category" value={ticket.category} />
            <Field label="Tutor" value={`${ticket.tutor_name} (${ticket.tutor_external_id})`} />
            <Field label="Team Leader" value={ticket.team_leader} />
            <Field label="Student ID" value={ticket.student_id} />
            <Field label="Session Num or Date" value={ticket.session_num_or_date} />
            <Field label="Response Deadline" value={ticket.need_response_deadline} />
            <Field label="Created" value={format(new Date(ticket.created_at), "PPp")} />
          </div>
          <Field label="Case Details" value={<span className="whitespace-pre-wrap">{ticket.case_details}</span>} />

          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">Validation & Follow-up</h3>
            <div className="space-y-2">
              <Label>Status Validation</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CSTicketStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Team Leader's Response</Label>
              <Textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={4}
                placeholder="Add response or follow-up notes..."
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Close</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
