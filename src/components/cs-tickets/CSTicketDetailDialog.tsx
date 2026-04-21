import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, History, Pencil, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { STATUS_OPTIONS, type CSTicketStatus } from "./csTicketCategories";
import { useCSTicketCategories } from "./useCSTicketCategories";
import { useUserRole } from "@/hooks/useUserRole";
import type { CSTicket } from "./useCSTickets";
import { CSTicketAuditDialog } from "./CSTicketAuditDialog";
import { logCSTicketChanges } from "./logCSTicketChanges";

interface Props {
  ticket: CSTicket | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated?: () => void;
}

export function CSTicketDetailDialog({ ticket, open, onOpenChange, onUpdated }: Props) {
  const { isAdmin, isSuperTeamLeader } = useUserRole();
  const canManage = isAdmin || isSuperTeamLeader;
  const { byType } = useCSTicketCategories();
  const csCategories = useMemo(() => byType["CS"] ?? [], [byType]);
  const eduCategories = useMemo(() => byType["Edu"] ?? [], [byType]);

  const [editMode, setEditMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Validation fields
  const [status, setStatus] = useState<CSTicketStatus>("Pending");
  const [response, setResponse] = useState("");

  // Editable ticket fields
  const [ticketNumber, setTicketNumber] = useState("");
  const [ticketDate, setTicketDate] = useState<Date>(new Date());
  const [csCategory, setCsCategory] = useState("");
  const [eduCategory, setEduCategory] = useState("");
  const [caseDetails, setCaseDetails] = useState("");
  const [studentId, setStudentId] = useState("");
  const [sessionNumOrDate, setSessionNumOrDate] = useState("");
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>(undefined);
  const [deadlineTime, setDeadlineTime] = useState<string>("17:00");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status);
      setResponse(ticket.team_leader_response ?? "");
      setTicketNumber(ticket.ticket_number);
      setTicketDate(new Date(ticket.ticket_date));
      setCsCategory(ticket.cs_category ?? (ticket.case_types.includes("CS") ? ticket.category : ""));
      setEduCategory(ticket.edu_category ?? (ticket.case_types.includes("Edu") ? ticket.category : ""));
      setCaseDetails(ticket.case_details ?? "");
      setStudentId(ticket.student_id ?? "");
      setSessionNumOrDate(ticket.session_num_or_date ?? "");
      if (ticket.need_response_deadline) {
        const d = new Date(ticket.need_response_deadline);
        setDeadlineDate(d);
        setDeadlineTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      } else {
        setDeadlineDate(undefined);
        setDeadlineTime("17:00");
      }
      setEditMode(false);
    }
  }, [ticket]);

  if (!ticket) return null;

  const buildDeadline = (): string | null => {
    if (!deadlineDate) return null;
    const [h, m] = (deadlineTime || "00:00").split(":").map((n) => parseInt(n, 10) || 0);
    const d = new Date(deadlineDate);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const handleSaveValidation = async () => {
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

  const handleSaveEdits = async () => {
    if (!ticketNumber.trim()) {
      toast({ title: "Ticket # required", variant: "destructive" });
      return;
    }
    if (!csCategory || !eduCategory) {
      toast({ title: "CS and Edu categories required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const combinedCategory = `CS: ${csCategory} | Edu: ${eduCategory}`;
      const { error } = await supabase
        .from("cs_tickets")
        .update({
          ticket_number: ticketNumber.trim(),
          ticket_date: format(ticketDate, "yyyy-MM-dd"),
          cs_category: csCategory,
          edu_category: eduCategory,
          category: combinedCategory,
          case_details: caseDetails || null,
          student_id: studentId || null,
          session_num_or_date: sessionNumOrDate || null,
          need_response_deadline: buildDeadline(),
          status,
          team_leader_response: response || null,
        })
        .eq("id", ticket.id);
      if (error) {
        if ((error as any).code === "23505") {
          throw new Error(`Ticket # "${ticketNumber.trim()}" already exists.`);
        }
        throw error;
      }
      toast({ title: "Ticket saved" });
      setEditMode(false);
      onOpenChange(false);
      onUpdated?.();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("cs_tickets").delete().eq("id", ticket.id);
      if (error) throw error;
      toast({ title: "Ticket deleted" });
      setConfirmDelete(false);
      onOpenChange(false);
      onUpdated?.();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {editMode ? "Edit Ticket" : ticket.ticket_number}
                {!editMode &&
                  ticket.case_types.map((t) => (
                    <Badge key={t} variant={t === "CS" ? "default" : "secondary"}>
                      {t}
                    </Badge>
                  ))}
              </DialogTitle>
              {canManage && !editMode && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                    <Pencil className="mr-2 h-3 w-3" /> Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="mr-2 h-3 w-3" /> Delete
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {!editMode ? (
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ticket Date" value={ticket.ticket_date} />
                <Field label="Tutor" value={`${ticket.tutor_name} (${ticket.tutor_external_id})`} />
                <Field
                  label="CS Category"
                  value={ticket.cs_category || (ticket.case_types.includes("CS") ? ticket.category : null)}
                />
                <Field
                  label="Edu Category"
                  value={ticket.edu_category || (ticket.case_types.includes("Edu") ? ticket.category : null)}
                />
                <Field label="Team Leader" value={ticket.team_leader} />
                <Field label="Student ID" value={ticket.student_id} />
                <Field label="Session Num or Date" value={ticket.session_num_or_date} />
                <Field
                  label="Response Deadline"
                  value={
                    ticket.need_response_deadline
                      ? format(new Date(ticket.need_response_deadline), "PPp")
                      : null
                  }
                />
                <Field label="Created" value={format(new Date(ticket.created_at), "PPp")} />
              </div>
              <Field label="Case Details" value={<span className="whitespace-pre-wrap">{ticket.case_details}</span>} />

              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">Validation & Follow-up</h3>
                <div className="space-y-2">
                  <Label>Status Validation</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as CSTicketStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
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
          ) : (
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ticket # *</Label>
                  <Input value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Ticket Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(ticketDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={ticketDate}
                        onSelect={(d) => d && setTicketDate(d)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Badge variant="default">CS</Badge> Category *
                  </Label>
                  <Select value={csCategory} onValueChange={setCsCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select CS category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {csCategories.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Badge variant="secondary">Edu</Badge> Category *
                  </Label>
                  <Select value={eduCategory} onValueChange={setEduCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Edu category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {eduCategories.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Student ID</Label>
                  <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Session Num or Date</Label>
                  <Input value={sessionNumOrDate} onChange={(e) => setSessionNumOrDate(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Need Response Deadline</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="flex-1 justify-start font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {deadlineDate ? format(deadlineDate, "PP") : <span className="text-muted-foreground">Date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={deadlineDate}
                          onSelect={setDeadlineDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={deadlineTime}
                      onChange={(e) => setDeadlineTime(e.target.value)}
                      className="w-[120px]"
                      disabled={!deadlineDate}
                    />
                    {deadlineDate && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setDeadlineDate(undefined)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Case Details</Label>
                <Textarea value={caseDetails} onChange={(e) => setCaseDetails(e.target.value)} rows={4} />
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">Validation & Follow-up</h3>
                <div className="space-y-2">
                  <Label>Status Validation</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as CSTicketStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Team Leader's Response</Label>
                  <Textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={4} />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Tutor and Team Leader cannot be changed after creation.
              </p>
            </div>
          )}

          <DialogFooter>
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => setEditMode(false)} disabled={saving}>
                  Cancel Edit
                </Button>
                <Button onClick={handleSaveEdits} disabled={saving}>
                  {saving ? "Saving..." : "Save Ticket"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Close
                </Button>
                <Button onClick={handleSaveValidation} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ticket <strong>{ticket.ticket_number}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
