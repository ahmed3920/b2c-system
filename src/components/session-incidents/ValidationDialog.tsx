import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ExternalLink, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { SessionIncident } from "@/hooks/useSessionIncidents";

interface Props {
  incident: SessionIncident;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canValidate?: boolean;
  onChanged: () => void;
}

export function ValidationDialog({ incident, open, onOpenChange, canValidate, onChanged }: Props) {
  const [reason, setReason] = useState(incident.rejection_reason ?? "");
  const [busy, setBusy] = useState(false);

  const updateStatus = async (status: "approved" | "rejected") => {
    setBusy(true);
    try {
      const { data: sd } = await supabase.auth.getSession();
      const userId = sd.session?.user.id ?? null;
      const { data: profile } = userId
        ? await supabase.from("profiles").select("full_name, mentor_name").eq("user_id", userId).maybeSingle()
        : { data: null as any };
      const name = profile?.full_name || profile?.mentor_name || null;
      const { error } = await supabase
        .from("session_incidents")
        .update({
          validation_status: status,
          validated_by: userId,
          validated_by_name: name,
          validated_at: new Date().toISOString(),
          rejection_reason: status === "rejected" ? (reason || null) : null,
        })
        .eq("id", incident.id);
      if (error) throw error;
      toast({ title: status === "approved" ? "Approved" : "Rejected" });
      onChanged();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toggleSentToCs = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("session_incidents")
        .update({ sent_to_cs: !incident.sent_to_cs })
        .eq("id", incident.id);
      if (error) throw error;
      toast({ title: incident.sent_to_cs ? "Marked not sent" : "Marked sent to CS" });
      onChanged();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="grid grid-cols-3 gap-2 text-sm py-1.5 border-b last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2">{value || "—"}</div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Session Incident
            <Badge variant={incident.source === "tutor_self" ? "secondary" : "outline"}>
              {incident.source === "tutor_self" ? "Tutor self-submitted" : "Staff"}
            </Badge>
            {incident.sent_to_cs && <Badge className="bg-blue-500/15 text-blue-700">Sent to CS</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <Row label="Tutor" value={`${incident.tutor_name} (${incident.tutor_external_id})`} />
          <Row label="Team Leader" value={incident.team_leader} />
          <Row label="Mentor" value={incident.assigned_mentor_name} />
          <Row label="Student" value={incident.student_name} />
          <Row label="Student ID" value={incident.student_id} />
          <Row label="Grade" value={incident.student_grade} />
          <Row label="Session Date" value={incident.session_date} />
          <Row label="Session Number" value={incident.session_number} />
          <Row label="Case Category" value={<Badge variant="outline">{incident.case_category}</Badge>} />
          <Row label="Description" value={<div className="whitespace-pre-wrap">{incident.case_description}</div>} />
          <Row
            label="Supporting Link"
            value={incident.supporting_link ? (
              <a href={incident.supporting_link} target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1">
                Open <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          />
          <Row label="Submitted by" value={`${incident.submitted_by_name || "—"} · ${format(new Date(incident.created_at), "PPp")}`} />
          {incident.validated_at && (
            <Row label="Validated by" value={`${incident.validated_by_name || "—"} · ${format(new Date(incident.validated_at), "PPp")}`} />
          )}
          {incident.rejection_reason && <Row label="Rejection reason" value={incident.rejection_reason} />}
        </div>

        {canValidate && incident.validation_status === "pending" && (
          <div className="space-y-2 pt-2 border-t">
            <Label>Rejection reason (if rejecting)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          {canValidate && incident.validation_status === "pending" && (
            <>
              <Button variant="destructive" onClick={() => updateStatus("rejected")} disabled={busy}>Reject</Button>
              <Button onClick={() => updateStatus("approved")} disabled={busy}>Approve</Button>
            </>
          )}
          {canValidate && incident.validation_status === "approved" && (
            <Button onClick={toggleSentToCs} disabled={busy} variant={incident.sent_to_cs ? "outline" : "default"}>
              <Send className="h-4 w-4 mr-1" />
              {incident.sent_to_cs ? "Mark not sent to CS" : "Mark sent to CS"}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
