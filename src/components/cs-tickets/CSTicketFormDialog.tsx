import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMergedRoster } from "@/hooks/useMergedRoster";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCSTicketCategories } from "./useCSTicketCategories";
import { useInactiveTutorIds } from "@/hooks/useInactiveTutorIds";
import { getMentorForTutor } from "@/lib/tutorMentorLookup";
import { teamLeaderMatches, normalizeName } from "@/lib/teamLeaderMatch";
import { refreshRosterCache } from "@/data/rosterCache";
import { ParentAttachmentsPanel } from "./ParentAttachmentsPanel";
import type { ParentAttachment } from "./useCSTickets";

interface MentorOption {
  user_id: string;
  full_name: string | null;
  mentor_name: string | null;
  team_leader: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}

type TicketKind = "tutor" | "system";

export function CSTicketFormDialog({ open, onOpenChange, onCreated }: Props) {
  const { byType } = useCSTicketCategories();
  const [kind, setKind] = useState<TicketKind>("tutor");
  const [tutorPickerOpen, setTutorPickerOpen] = useState(false);
  // First entry is the primary tutor; the rest are stored in additional_tutors.
  const [tutorIds, setTutorIds] = useState<string[]>([]);
  const [ticketNumber, setTicketNumber] = useState<string>("");
  const [csCategory, setCsCategory] = useState<string>("");
  const [eduCategory, setEduCategory] = useState<string>("");
  const [ticketDate, setTicketDate] = useState<Date>(new Date());
  const [caseDetails, setCaseDetails] = useState("");
  const [studentId, setStudentId] = useState("");
  const [sessionNumOrDate, setSessionNumOrDate] = useState("");
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>(undefined);
  const [deadlineTime, setDeadlineTime] = useState<string>("17:00");
  const [submitting, setSubmitting] = useState(false);
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [parentAttachments, setParentAttachments] = useState<ParentAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);


  const { inactiveIds } = useInactiveTutorIds();
  const tutorRoster = useMergedRoster();
  const activeTutors = useMemo(
    () => tutorRoster.filter((t) => !inactiveIds.has(t.id)),
    [inactiveIds, tutorRoster],
  );
  const selectedTutors = useMemo(
    () => tutorIds.map((id) => tutorRoster.find((t) => t.id === id)).filter(Boolean) as typeof tutorRoster,
    [tutorIds, tutorRoster],
  );
  const selectedTutor = selectedTutors[0]; // primary tutor

  // Per-tutor mentor overrides (tutorId -> mentor user_id; "" = explicitly none)
  const [tutorMentorOverrides, setTutorMentorOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    refreshRosterCache();
    supabase.rpc("list_available_mentors").then(({ data }) => {
      if (data) setMentors(data as MentorOption[]);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, mentor_name")
        .eq("user_id", uid)
        .maybeSingle();
      setCurrentUserName(prof?.full_name ?? prof?.mentor_name ?? null);
    });
  }, [open]);

  const resolveMentorFor = (tutorId: string): MentorOption | null => {
    const tutor = tutorRoster.find((t) => t.id === tutorId);
    if (!tutor) return null;
    const name = getMentorForTutor(tutor.id);
    if (!name || name === "—") return null;
    const target = normalizeName(name);
    return (
      mentors.find(
        (m) =>
          teamLeaderMatches(m.team_leader, tutor.team_leader) &&
          (normalizeName(m.full_name ?? "") === target || normalizeName(m.mentor_name ?? "") === target),
      ) ?? null
    );
  };

  const effectiveMentorFor = (tutorId: string): MentorOption | null => {
    const override = tutorMentorOverrides[tutorId];
    if (override !== undefined) {
      return override ? mentors.find((m) => m.user_id === override) ?? null : null;
    }
    return resolveMentorFor(tutorId);
  };

  const recommendedMentor = useMemo(
    () => (selectedTutor ? effectiveMentorFor(selectedTutor.id) : null),
    [selectedTutor, mentors, tutorRoster, tutorMentorOverrides],
  );

  const csCategories = useMemo(() => byType["CS"] ?? [], [byType]);
  const eduCategories = useMemo(() => byType["Edu"] ?? [], [byType]);

  // Reset categories if no longer valid
  useEffect(() => {
    if (csCategory && !csCategories.some((c) => c.name === csCategory)) setCsCategory("");
  }, [csCategories, csCategory]);
  useEffect(() => {
    if (eduCategory && !eduCategories.some((c) => c.name === eduCategory)) setEduCategory("");
  }, [eduCategories, eduCategory]);

  const reset = () => {
    setKind("tutor");
    setTutorIds([]);
    setTutorMentorOverrides({});
    setTicketNumber("");
    setCsCategory("");
    setEduCategory("");
    setTicketDate(new Date());
    setCaseDetails("");
    setStudentId("");
    setSessionNumOrDate("");
    setDeadlineDate(undefined);
    setDeadlineTime("17:00");
    setParentAttachments([]);
    setPendingFiles([]);
  };


  const handleAttachmentsChange = (next: ParentAttachment[]) => {
    // detect newly added pending file entries; if removed, drop matching file
    setParentAttachments(next);
    // Sync pendingFiles: remove files whose pending entries no longer exist
    setPendingFiles((cur) =>
      cur.filter((f) =>
        next.some((a) => a.kind === "file" && a.url === `pending:${f.name}` && a.label === f.name),
      ),
    );
  };

  const handleFilesPicked = (files: File[]) => {
    setPendingFiles((cur) => [...cur, ...files]);
  };

  const addTutor = (id: string) => {
    setTutorIds((cur) => (cur.includes(id) ? cur : [...cur, id]));
  };
  const removeTutor = (id: string) => {
    setTutorIds((cur) => cur.filter((x) => x !== id));
    setTutorMentorOverrides((cur) => {
      const { [id]: _, ...rest } = cur;
      return rest;
    });
  };
  const setMentorForTutor = (tutorId: string, mentorUserId: string) => {
    // "__none" -> explicit none; "__auto" -> clear override; otherwise mentor user_id
    setTutorMentorOverrides((cur) => {
      if (mentorUserId === "__auto") {
        const { [tutorId]: _, ...rest } = cur;
        return rest;
      }
      return { ...cur, [tutorId]: mentorUserId === "__none" ? "" : mentorUserId };
    });
  };

  const buildDeadline = (): string | null => {
    if (!deadlineDate) return null;
    const [h, m] = (deadlineTime || "00:00").split(":").map((n) => parseInt(n, 10) || 0);
    const d = new Date(deadlineDate);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const handleSubmit = async () => {
    if (!ticketNumber.trim()) {
      toast({ title: "Ticket # required", description: "Enter a unique ticket number.", variant: "destructive" });
      return;
    }
    if (!selectedTutor) {
      toast({ title: "Tutor required", description: "Pick a tutor from the list.", variant: "destructive" });
      return;
    }
    if (!csCategory) {
      toast({ title: "CS Category required", description: "Select a CS category.", variant: "destructive" });
      return;
    }
    if (!eduCategory) {
      toast({ title: "Edu Category required", description: "Select an Edu category.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;
      const combinedCategory = `CS: ${csCategory} | Edu: ${eduCategory}`;
      const additional = selectedTutors.slice(1).map((t) => {
        const m = effectiveMentorFor(t.id);
        return {
          tutor_external_id: t.id,
          tutor_name: t.name,
          team_leader: t.team_leader || "",
          assigned_mentor_id: m?.user_id ?? null,
          assigned_mentor_name: m ? m.full_name || m.mentor_name || null : null,
        };
      });
      const { data: inserted, error } = await supabase
        .from("cs_tickets")
        .insert({
          ticket_number: ticketNumber.trim(),
          ticket_date: format(ticketDate, "yyyy-MM-dd"),
          case_type: "CS",
          case_types: ["CS", "Edu"],
          category: combinedCategory,
          cs_category: csCategory,
          edu_category: eduCategory,
          tutor_external_id: selectedTutor.id,
          tutor_name: selectedTutor.name,
          team_leader: selectedTutor.team_leader,
          additional_tutors: additional,
          case_details: caseDetails || null,
          student_id: studentId || null,
          session_num_or_date: sessionNumOrDate || null,
          need_response_deadline: buildDeadline(),
          created_by: userId,
          created_by_name: currentUserName,
          assigned_mentor_id: recommendedMentor?.user_id ?? null,
          assigned_mentor_name: recommendedMentor
            ? recommendedMentor.full_name || recommendedMentor.mentor_name || null
            : null,
          mentor_assigned_at: recommendedMentor ? new Date().toISOString() : null,
          mentor_assigned_by: recommendedMentor ? userId : null,
        } as any)
        .select("id")
        .single();
      if (error) {
        if ((error as any).code === "23505" || /duplicate|unique/i.test(error.message)) {
          throw new Error(`Ticket # "${ticketNumber.trim()}" already exists. Choose a different one.`);
        }
        throw error;
      }
      const newTicketId = (inserted as any)?.id as string | undefined;

      // Upload pending parent attachment files and persist the merged list
      if (newTicketId && (pendingFiles.length > 0 || parentAttachments.length > 0)) {
        try {
          const nonFile = parentAttachments.filter((a) => !(a.kind === "file" && a.url.startsWith("pending:")));
          const finalList: ParentAttachment[] = [...nonFile];
          for (const file of pendingFiles) {
            const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const path = `${newTicketId}/parent/${Date.now()}_${safe}`;
            const { error: upErr } = await supabase.storage
              .from("cs-recordings")
              .upload(path, file, { upsert: false, contentType: file.type || undefined });
            if (upErr) throw upErr;
            finalList.push({
              kind: "file",
              url: path,
              path,
              label: file.name,
              size: file.size,
              mime: file.type,
              added_at: new Date().toISOString(),
              added_by: userId ?? undefined,
              added_by_name: currentUserName ?? undefined,
            });
          }
          await supabase
            .from("cs_tickets")
            .update({ parent_attachments: finalList } as any)
            .eq("id", newTicketId);
        } catch (e: any) {
          toast({ title: "Attachments upload failed", description: e.message, variant: "destructive" });
        }
      }

      toast({ title: "Ticket created", description: "The CS ticket has been logged." });
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast({ title: "Failed to create ticket", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New CS Ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Staff Info */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Staff Info</h3>
              <span className="text-xs text-muted-foreground">
                Add one or more tutors. The first is the primary tutor.
              </span>
            </div>

            <div className="space-y-2">
              <Label>Tutors *</Label>
              <Popover open={tutorPickerOpen} onOpenChange={setTutorPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    <span className="truncate text-muted-foreground">
                      {selectedTutors.length === 0
                        ? "Search and add tutors..."
                        : `Add another tutor (${selectedTutors.length} added)`}
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
                        {activeTutors.map((t) => {
                          const isSelected = tutorIds.includes(t.id);
                          return (
                            <CommandItem
                              key={t.id}
                              value={`${t.name} ${t.id}`}
                              onSelect={() => {
                                if (isSelected) {
                                  removeTutor(t.id);
                                } else {
                                  addTutor(t.id);
                                }
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span>{t.name}</span>
                                <span className="text-xs text-muted-foreground">{t.id} · {t.team_leader}</span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {selectedTutors.length > 0 && (
              <div className="space-y-2">
                {selectedTutors.map((t, idx) => {
                  const eligibleMentors = mentors.filter((m) =>
                    teamLeaderMatches(m.team_leader, t.team_leader),
                  );
                  const rec = resolveMentorFor(t.id);
                  const override = tutorMentorOverrides[t.id];
                  const selectValue =
                    override === undefined ? "__auto" : override === "" ? "__none" : override;
                  const effective = effectiveMentorFor(t.id);
                  return (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border p-2"
                    >
                      <Badge variant={idx === 0 ? "default" : "secondary"} className="gap-1 pl-2 pr-1 py-1">
                        <span>
                          {idx === 0 ? "Primary: " : ""}
                          {t.name} ({t.id}) — TL: {t.team_leader || "—"}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeTutor(t.id)}
                          className="ml-1 rounded hover:bg-background/30 p-0.5"
                          aria-label={`Remove ${t.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                      <div className="ml-auto flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Assigned mentor</Label>
                        <Select
                          value={selectValue}
                          onValueChange={(v) => setMentorForTutor(t.id, v)}
                        >
                          <SelectTrigger className="h-8 w-[240px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[260px]">
                            <SelectItem value="__auto">
                              Auto: {rec ? rec.full_name || rec.mentor_name : "no match"}
                            </SelectItem>
                            <SelectItem value="__none">No mentor</SelectItem>
                            {eligibleMentors.length > 0 && (
                              <SelectGroup>
                                <SelectLabel>Same team leader</SelectLabel>
                                {eligibleMentors.map((m) => (
                                  <SelectItem key={m.user_id} value={m.user_id}>
                                    {m.full_name || m.mentor_name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                            <SelectGroup>
                              <SelectLabel>All mentors</SelectLabel>
                              {mentors.map((m) => (
                                <SelectItem key={`all-${m.user_id}`} value={m.user_id}>
                                  {m.full_name || m.mentor_name} {m.team_leader ? `· ${m.team_leader}` : ""}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="basis-full text-xs text-muted-foreground">
                        {effective
                          ? `Will notify: ${effective.full_name || effective.mentor_name}`
                          : "No mentor will be notified for this tutor"}
                      </p>
                    </div>
                  );
                })}
                {selectedTutors.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Team leaders of all listed tutors will see this ticket and be notified.
                    Each tutor's assigned mentor is also notified.
                  </p>
                )}
              </div>
            )}
          </section>


          {/* Case Info */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Case Info</h3>
              <span className="text-xs text-muted-foreground">
                Both <Badge variant="default" className="mx-1">CS</Badge> and <Badge variant="secondary" className="mx-1">Edu</Badge> categories are required
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Ticket # *</Label>
                <Input
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  placeholder="e.g. CS-001234"
                />
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
                  <SelectTrigger><SelectValue placeholder="Select CS category" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {csCategories.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">No CS categories. Ask admin to add some.</div>
                    ) : csCategories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Badge variant="secondary">Edu</Badge> Category *
                </Label>
                <Select value={eduCategory} onValueChange={setEduCategory}>
                  <SelectTrigger><SelectValue placeholder="Select Edu category" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {eduCategories.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">No Edu categories. Ask admin to add some.</div>
                    ) : eduCategories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Case Details</Label>
              <Textarea
                value={caseDetails}
                onChange={(e) => setCaseDetails(e.target.value)}
                placeholder="Describe the case..."
                rows={4}
              />
            </div>
          </section>

          {/* Student Info */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Student Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Student ID</Label>
                <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="e.g. S-12345" />
              </div>
              <div className="space-y-2">
                <Label>Session Num or Date</Label>
                <Input
                  value={sessionNumOrDate}
                  onChange={(e) => setSessionNumOrDate(e.target.value)}
                  placeholder="e.g. 42 or 2026-04-15"
                />
              </div>
              <div className="space-y-2">
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeadlineDate(undefined)}
                      title="Clear"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Parent Attachments */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Parent Attachments</h3>
            <ParentAttachmentsPanel
              ticketId={null}
              attachments={parentAttachments}
              onChange={handleAttachmentsChange}
              onFilesPicked={handleFilesPicked}
              canEdit={true}
              currentUserName={currentUserName}
            />
            <p className="text-xs text-muted-foreground">
              Files will be uploaded after the ticket is created.
            </p>
          </section>



          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground flex items-center justify-between">
            <span>Status will start as <Badge variant="secondary" className="ml-1">Pending</Badge></span>
            <span>Ticket # must be unique</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating..." : "Create Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
