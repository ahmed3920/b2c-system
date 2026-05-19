import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export function CSTicketFormDialog({ open, onOpenChange, onCreated }: Props) {
  const { byType } = useCSTicketCategories();
  const [tutorPickerOpen, setTutorPickerOpen] = useState(false);
  const [tutorId, setTutorId] = useState<string>("");
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

  const { inactiveIds } = useInactiveTutorIds();
  const tutorRoster = useMergedRoster();
  const activeTutors = useMemo(
    () => tutorRoster.filter((t) => !inactiveIds.has(t.id)),
    [inactiveIds, tutorRoster],
  );
  const selectedTutor = useMemo(() => tutorRoster.find((t) => t.id === tutorId), [tutorId, tutorRoster]);

  useEffect(() => {
    if (!open) return;
    supabase.rpc("list_available_mentors").then(({ data }) => {
      if (data) setMentors(data as MentorOption[]);
    });
  }, [open]);

  const recommendedMentor = useMemo(() => {
    if (!selectedTutor) return null;
    const name = getMentorForTutor(selectedTutor.id);
    if (!name || name === "—") return null;
    const target = normalizeName(name);
    return (
      mentors.find(
        (m) =>
          teamLeaderMatches(m.team_leader, selectedTutor.team_leader) &&
          (normalizeName(m.full_name ?? "") === target || normalizeName(m.mentor_name ?? "") === target),
      ) ?? null
    );
  }, [selectedTutor, mentors]);

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
    setTutorId("");
    setTicketNumber("");
    setCsCategory("");
    setEduCategory("");
    setTicketDate(new Date());
    setCaseDetails("");
    setStudentId("");
    setSessionNumOrDate("");
    setDeadlineDate(undefined);
    setDeadlineTime("17:00");
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
      const { error } = await supabase.from("cs_tickets").insert({
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
        case_details: caseDetails || null,
        student_id: studentId || null,
        session_num_or_date: sessionNumOrDate || null,
        need_response_deadline: buildDeadline(),
        created_by: userId,
        assigned_mentor_id: recommendedMentor?.user_id ?? null,
        assigned_mentor_name: recommendedMentor
          ? recommendedMentor.full_name || recommendedMentor.mentor_name || null
          : null,
        mentor_assigned_at: recommendedMentor ? new Date().toISOString() : null,
        mentor_assigned_by: recommendedMentor ? userId : null,
      });
      if (error) {
        if ((error as any).code === "23505" || /duplicate|unique/i.test(error.message)) {
          throw new Error(`Ticket # "${ticketNumber.trim()}" already exists. Choose a different one.`);
        }
        throw error;
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
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Staff Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1 space-y-2">
                <Label>Tutor Name *</Label>
                <Popover open={tutorPickerOpen} onOpenChange={setTutorPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate">{selectedTutor?.name ?? "Search tutor..."}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                    <Command>
                      <CommandInput placeholder="Search tutor by name or ID..." />
                      <CommandList>
                        <CommandEmpty>No tutor found.</CommandEmpty>
                        <CommandGroup>
                          {activeTutors.map((t) => (
                            <CommandItem
                              key={t.id}
                              value={`${t.name} ${t.id}`}
                              onSelect={() => {
                                setTutorId(t.id);
                                setTutorPickerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", tutorId === t.id ? "opacity-100" : "opacity-0")} />
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
                <Label>Tutor ID</Label>
                <Input value={selectedTutor?.id ?? ""} readOnly className="bg-muted" placeholder="Auto-filled" />
              </div>
              <div className="space-y-2">
                <Label>Team Leader</Label>
                <Input value={selectedTutor?.team_leader ?? ""} readOnly className="bg-muted" placeholder="Auto-filled" />
              </div>
            </div>
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
