import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Send, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useCsFullAccess } from "@/hooks/useCsFullAccess";
import { IncidentFormDialog } from "./IncidentFormDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [ticketNumber, setTicketNumber] = useState(incident.cs_ticket_number ?? "");
  const [csResponse, setCsResponse] = useState(incident.cs_response ?? "");
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { role } = useUserRole();
  const { hasAccess: csFullAccess } = useCsFullAccess();
  const canManageCs = role === "admin" || csFullAccess;
  const isAdmin = role === "admin";

  const handleDelete = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("session_incidents").delete().eq("id", incident.id);
      if (error) throw error;
      toast({ title: "Incident deleted" });
      setConfirmDelete(false);
      onOpenChange(false);
      onChanged();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

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

  const markSentToCs = async () => {
    if (!ticketNumber.trim()) {
      toast({ title: "Ticket ID required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("session_incidents")
        .update({
          sent_to_cs: true,
          cs_ticket_number: ticketNumber.trim(),
          cs_status: "open",
        })
        .eq("id", incident.id);
      if (error) throw error;
      toast({ title: "Marked sent to CS — ticket open" });
      onChanged();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const saveCsResponse = async (close: boolean) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("session_incidents")
        .update({
          cs_response: csResponse.trim() || null,
          cs_status: close ? "closed" : "open",
        })
        .eq("id", incident.id);
      if (error) throw error;
      toast({ title: close ? "Ticket closed" : "Response saved" });
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
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Session Incident
            <Badge variant={incident.source === "tutor_self" ? "secondary" : "outline"}>
              {incident.source === "tutor_self" ? "Tutor self-submitted" : "Staff"}
            </Badge>
            {incident.sent_to_cs && (
              <Badge className={incident.cs_status === "closed" ? "bg-gray-500/15 text-gray-700" : "bg-blue-500/15 text-blue-700"}>
                {incident.cs_status === "closed" ? "CS Closed" : "CS Open"}
                {incident.cs_ticket_number ? ` · #${incident.cs_ticket_number}` : ""}
              </Badge>
            )}
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
          {incident.cs_response && <Row label="CS Response" value={<div className="whitespace-pre-wrap">{incident.cs_response}</div>} />}
        </div>

        {canValidate && incident.validation_status === "pending" && (
          <div className="space-y-2 pt-2 border-t">
            <Label>Rejection reason (if rejecting)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        )}

        {canManageCs && incident.validation_status === "approved" && (
          <div className="space-y-3 pt-3 border-t">
            <div className="text-sm font-medium">CS Tracking</div>
            {!incident.sent_to_cs ? (
              <div className="space-y-2">
                <Label>CS Ticket ID *</Label>
                <div className="flex gap-2">
                  <Input
                    value={ticketNumber}
                    onChange={(e) => setTicketNumber(e.target.value)}
                    placeholder="Enter CS ticket ID"
                  />
                  <Button onClick={markSentToCs} disabled={busy}>
                    <Send className="h-4 w-4 mr-1" /> Mark Sent
                  </Button>
                </div>
              </div>
            ) : incident.cs_status !== "closed" ? (
              <div className="space-y-2">
                <Label>CS Response</Label>
                <Textarea
                  value={csResponse}
                  onChange={(e) => setCsResponse(e.target.value)}
                  rows={3}
                  placeholder="Paste CS reply here..."
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => saveCsResponse(false)} disabled={busy}>
                    Save Response
                  </Button>
                  <Button onClick={() => saveCsResponse(true)} disabled={busy || !csResponse.trim()}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Close Ticket
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Ticket closed. CS response recorded above.</div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)} disabled={busy}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={busy}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </>
          )}
          {canValidate && incident.validation_status === "pending" && (
            <>
              <Button variant="destructive" onClick={() => updateStatus("rejected")} disabled={busy}>Reject</Button>
              <Button onClick={() => updateStatus("approved")} disabled={busy}>Approve</Button>
            </>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>

      {isAdmin && editOpen && (
        <IncidentFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          incident={incident}
          onCreated={() => { onChanged(); onOpenChange(false); }}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this incident?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the session incident. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
