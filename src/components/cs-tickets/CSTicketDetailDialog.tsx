import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown, History, Lock, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useMergedRoster } from "@/hooks/useMergedRoster";
import { useInactiveTutorIds } from "@/hooks/useInactiveTutorIds";
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
import { useCsFullAccess } from "@/hooks/useCsFullAccess";
import type { CSTicket } from "./useCSTickets";
import { CSTicketAuditDialog } from "./CSTicketAuditDialog";
import { logCSTicketChanges } from "./logCSTicketChanges";
import { MentorEvaluationSection } from "./MentorEvaluationSection";
import { getMentorForTutor } from "@/lib/tutorMentorLookup";
import { ParentAttachmentsPanel } from "./ParentAttachmentsPanel";
import type { ParentAttachment } from "./useCSTickets";

interface Props {
  ticket: CSTicket | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated?: () => void;
}

export function CSTicketDetailDialog({ ticket, open, onOpenChange, onUpdated }: Props) {
  const { isAdmin, isSuperTeamLeader, isTeamLeader, isMentor } = useUserRole();
  const { hasAccess: csFullAccess } = useCsFullAccess();
  const canManage = isAdmin || isSuperTeamLeader || csFullAccess;
  const canDelete = isAdmin || isSuperTeamLeader;
  const canValidate = isAdmin || isSuperTeamLeader || isTeamLeader;
  const isAssignedMentorOnly = !canValidate && !csFullAccess && isMentor;
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

  // Editable tutor identity
  const [tutorExternalId, setTutorExternalId] = useState<string>("");
  const [tutorName, setTutorName] = useState<string>("");
  const [tutorTeamLeader, setTutorTeamLeader] = useState<string>("");
  const [tutorPickerOpen, setTutorPickerOpen] = useState(false);
  const tutorRoster = useMergedRoster();
  const { inactiveIds } = useInactiveTutorIds();
  const activeTutors = useMemo(
    () => tutorRoster.filter((t) => !inactiveIds.has(t.id)),
    [inactiveIds, tutorRoster],
  );

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [parentAttachments, setParentAttachments] = useState<ParentAttachment[]>([]);

  useEffect(() => {
    if (ticket) {
      setStatus(STATUS_OPTIONS.includes(ticket.status) ? ticket.status : "Pending");
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
      setParentAttachments(ticket.parent_attachments ?? []);
      setTutorExternalId(ticket.tutor_external_id);
      setTutorName(ticket.tutor_name);
      setTutorTeamLeader(ticket.team_leader);
    }
  }, [ticket]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id ?? null;
      setCurrentUserId(uid);
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, mentor_name")
          .eq("user_id", uid)
          .maybeSingle();
        setCurrentUserName(prof?.full_name ?? prof?.mentor_name ?? null);
      }
    });
  }, []);

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
      const after = { status, team_leader_response: response || null };
      const { error } = await supabase
        .from("cs_tickets")
        .update(after)
        .eq("id", ticket.id);
      if (error) throw error;
      await logCSTicketChanges({
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number,
        before: { status: ticket.status, team_leader_response: ticket.team_leader_response },
        after,
      });
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
    if (!csCategory) {
      toast({ title: "CS category required", variant: "destructive" });
      return;
    }
    const isSystemTicket = tutorExternalId === "SYSTEM" || !tutorExternalId;
    if (!isSystemTicket && !eduCategory) {
      toast({ title: "Edu category required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const combinedCategory = isSystemTicket
        ? `System: ${csCategory}`
        : `CS: ${csCategory} | Edu: ${eduCategory}`;
      const after: any = {
        ticket_number: ticketNumber.trim(),
        ticket_date: format(ticketDate, "yyyy-MM-dd"),
        cs_category: csCategory,
        edu_category: isSystemTicket ? null : eduCategory,
        category: combinedCategory,
        case_details: caseDetails || null,
        student_id: studentId || null,
        session_num_or_date: sessionNumOrDate || null,
        need_response_deadline: buildDeadline(),
        status,
        team_leader_response: response || null,
        tutor_external_id: tutorExternalId,
        tutor_name: tutorName,
        team_leader: tutorTeamLeader,
        case_types: isSystemTicket ? ["CS"] : ["CS", "Edu"],
      };
      const { error } = await supabase.from("cs_tickets").update(after).eq("id", ticket.id);
      if (error) {
        if ((error as any).code === "23505") {
          throw new Error(`Ticket # "${ticketNumber.trim()}" already exists.`);
        }
        throw error;
      }
      await logCSTicketChanges({
        ticketId: ticket.id,
        ticketNumber: after.ticket_number,
        before: {
          ticket_number: ticket.ticket_number,
          ticket_date: ticket.ticket_date,
          cs_category: ticket.cs_category,
          edu_category: ticket.edu_category,
          case_details: ticket.case_details,
          student_id: ticket.student_id,
          session_num_or_date: ticket.session_num_or_date,
          need_response_deadline: ticket.need_response_deadline,
          status: ticket.status,
          team_leader_response: ticket.team_leader_response,
          tutor_external_id: ticket.tutor_external_id,
          tutor_name: ticket.tutor_name,
          team_leader: ticket.team_leader,
        },
        after,
      });
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

  const handleToggleClose = async () => {
    if (!ticket) return;
    setClosing(true);
    try {
      const willClose = !ticket.closed_at;
      const after: any = willClose
        ? {
            closed_at: new Date().toISOString(),
            closed_by: currentUserId,
            closed_by_name: currentUserName,
            status: "Closed",
          }
        : {
            closed_at: null,
            closed_by: null,
            closed_by_name: null,
            status: ticket.mentor_validation === "valid"
              ? "Valid"
              : ticket.mentor_validation === "invalid"
              ? "Not Valid"
              : ticket.mentor_validation === "not_a_complain"
              ? "Not a Complain"
              : "Pending",
          };
      const { error } = await supabase.from("cs_tickets").update(after as any).eq("id", ticket.id);
      if (error) throw error;
      // Audit log: status change is tracked by logCSTicketChanges
      await logCSTicketChanges({
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number,
        before: { status: ticket.status },
        after: { status: after.status },
      });
      toast({ title: willClose ? "Ticket closed" : "Ticket reopened" });
      onOpenChange(false);
      onUpdated?.();
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setClosing(false);
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
              {!editMode && (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}>
                    <History className="mr-2 h-3 w-3" /> History
                  </Button>
                  {canManage && (
                    <Button
                      size="sm"
                      variant={ticket.closed_at ? "outline" : "secondary"}
                      onClick={handleToggleClose}
                      disabled={closing}
                    >
                      {ticket.closed_at ? (
                        <><RotateCcw className="mr-2 h-3 w-3" /> Reopen</>
                      ) : (
                        <><Lock className="mr-2 h-3 w-3" /> Close</>
                      )}
                    </Button>
                  )}
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                      <Pencil className="mr-2 h-3 w-3" /> Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                      <Trash2 className="mr-2 h-3 w-3" /> Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          {!editMode ? (
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ticket Date" value={ticket.ticket_date} />
                <Field
                  label={ticket.additional_tutors.length > 0 ? "Primary Tutor" : "Tutor"}
                  value={`${ticket.tutor_name} (${ticket.tutor_external_id})`}
                />
                <Field
                  label="CS Category"
                  value={ticket.cs_category || (ticket.case_types.includes("CS") ? ticket.category : null)}
                />
                <Field
                  label="Edu Category"
                  value={ticket.edu_category || (ticket.case_types.includes("Edu") ? ticket.category : null)}
                />
                <Field label="Team Leader" value={ticket.team_leader} />
                <Field label="Tutor's Mentor" value={getMentorForTutor(ticket.tutor_external_id)} />
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
                <Field
                  label="Created"
                  value={
                    <>
                      {format(new Date(ticket.created_at), "PPp")}
                      {ticket.created_by_name && (
                        <span className="block text-xs text-muted-foreground">by {ticket.created_by_name}</span>
                      )}
                    </>
                  }
                />
                {ticket.closed_at && (
                  <Field
                    label="Closed"
                    value={
                      <>
                        {format(new Date(ticket.closed_at), "PPp")}
                        {ticket.closed_by_name && (
                          <span className="block text-xs text-muted-foreground">by {ticket.closed_by_name}</span>
                        )}
                      </>
                    }
                  />
                )}
              </div>
              {ticket.additional_tutors.length > 0 && (
                <Field
                  label="Additional Tutors"
                  value={
                    <div className="flex flex-col gap-1.5">
                      {ticket.additional_tutors.map((t) => (
                        <div key={t.tutor_external_id} className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {t.tutor_name} ({t.tutor_external_id}) — TL: {t.team_leader || "—"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Mentor: {t.assigned_mentor_name || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  }
                />
              )}
              <Field label="Case Details" value={<span className="whitespace-pre-wrap">{ticket.case_details}</span>} />

              <div className="border-t pt-4">
                <ParentAttachmentsPanel
                  ticketId={ticket.id}
                  attachments={parentAttachments}
                  onChange={setParentAttachments}
                  canEdit={canManage || canValidate}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                />
              </div>



              {canValidate && (
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
              )}

              <MentorEvaluationSection ticket={ticket} onChanged={() => onUpdated?.()} />
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
                <div className="space-y-2 md:col-span-2">
                  <Label>Tutor</Label>
                  <Popover open={tutorPickerOpen} onOpenChange={setTutorPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        <span className="truncate">
                          {tutorExternalId === "SYSTEM" || !tutorExternalId ? (
                            <span className="text-muted-foreground">System / Content Issue — click to assign a tutor</span>
                          ) : (
                            <>{tutorName} <span className="text-muted-foreground">({tutorExternalId}) · TL: {tutorTeamLeader || "—"}</span></>
                          )}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                      <Command>
                        <CommandInput placeholder="Search tutor by name or ID..." />
                        <CommandList>
                          <CommandEmpty>No tutor found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="system content issue"
                              onSelect={() => {
                                setTutorExternalId("SYSTEM");
                                setTutorName("System / Content Issue");
                                setTutorTeamLeader("—");
                                setTutorPickerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", tutorExternalId === "SYSTEM" ? "opacity-100" : "opacity-0")} />
                              <span className="italic">System / Content Issue (no tutor)</span>
                            </CommandItem>
                            {activeTutors.map((t) => (
                              <CommandItem
                                key={t.id}
                                value={`${t.name} ${t.id}`}
                                onSelect={() => {
                                  setTutorExternalId(t.id);
                                  setTutorName(t.name);
                                  setTutorTeamLeader(t.team_leader || "");
                                  setTutorPickerOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", tutorExternalId === t.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                  <span>{t.name}</span>
                                  <span className="text-xs text-muted-foreground">{t.id} · {t.team_leader}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
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
                {tutorExternalId === "SYSTEM"
                  ? "This is a System / Content Issue ticket. Assign a tutor to convert it into a tutor complaint."
                  : "Changing the tutor updates the Team Leader automatically."}
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
                {canValidate && (
                  <Button onClick={handleSaveValidation} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                )}
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

      <CSTicketAuditDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        ticketId={ticket.id}
        ticketNumber={ticket.ticket_number}
      />
    </>
  );
}
