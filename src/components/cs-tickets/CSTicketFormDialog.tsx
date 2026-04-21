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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { tutorRoster } from "@/data/tutorRoster";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { CSTicketCaseType } from "./csTicketCategories";
import { useCSTicketCategories } from "./useCSTicketCategories";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}

export function CSTicketFormDialog({ open, onOpenChange, onCreated }: Props) {
  const { byType } = useCSTicketCategories();
  const [tutorPickerOpen, setTutorPickerOpen] = useState(false);
  const [tutorId, setTutorId] = useState<string>("");
  const [caseTypes, setCaseTypes] = useState<CSTicketCaseType[]>(["CS"]);
  const [category, setCategory] = useState<string>("");
  const [ticketDate, setTicketDate] = useState<Date>(new Date());
  const [caseDetails, setCaseDetails] = useState("");
  const [studentId, setStudentId] = useState("");
  const [sessionNumOrDate, setSessionNumOrDate] = useState("");
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>(undefined);
  const [deadlineTime, setDeadlineTime] = useState<string>("17:00");
  const [submitting, setSubmitting] = useState(false);

  const selectedTutor = useMemo(() => tutorRoster.find((t) => t.id === tutorId), [tutorId]);

  // Combined category list across selected case types (deduplicated)
  const availableCategories = useMemo(() => {
    const seen = new Set<string>();
    const out: { name: string; from: CSTicketCaseType[] }[] = [];
    for (const t of caseTypes) {
      for (const c of byType[t] ?? []) {
        if (seen.has(c.name)) {
          const existing = out.find((o) => o.name === c.name);
          if (existing && !existing.from.includes(t)) existing.from.push(t);
          continue;
        }
        seen.add(c.name);
        out.push({ name: c.name, from: [t] });
      }
    }
    return out;
  }, [byType, caseTypes]);

  // Reset category if no longer valid
  useEffect(() => {
    if (category && !availableCategories.some((c) => c.name === category)) setCategory("");
  }, [availableCategories, category]);

  const toggleCaseType = (t: CSTicketCaseType) => {
    setCaseTypes((prev) => {
      if (prev.includes(t)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter((x) => x !== t);
      }
      return [...prev, t];
    });
  };

  const reset = () => {
    setTutorId("");
    setCaseTypes(["CS"]);
    setCategory("");
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
    if (!selectedTutor) {
      toast({ title: "Tutor required", description: "Pick a tutor from the list.", variant: "destructive" });
      return;
    }
    if (caseTypes.length === 0) {
      toast({ title: "Case type required", description: "Pick at least one case type.", variant: "destructive" });
      return;
    }
    if (!category) {
      toast({ title: "Category required", description: "Select a category.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;
      const { error } = await supabase.from("cs_tickets").insert({
        ticket_date: format(ticketDate, "yyyy-MM-dd"),
        case_type: caseTypes[0], // legacy single column kept in sync
        case_types: caseTypes,
        category,
        tutor_external_id: selectedTutor.id,
        tutor_name: selectedTutor.name,
        team_leader: selectedTutor.team_leader,
        case_details: caseDetails || null,
        student_id: studentId || null,
        session_num_or_date: sessionNumOrDate || null,
        need_response_deadline: buildDeadline(),
        created_by: userId,
      });
      if (error) throw error;
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
                          {tutorRoster.map((t) => (
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
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Case Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Label>Case Type * <span className="text-xs text-muted-foreground">(select one or both)</span></Label>
                <div className="flex gap-2">
                  {(["CS", "Edu"] as const).map((t) => {
                    const checked = caseTypes.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleCaseType(t)}
                        className={cn(
                          "flex-1 inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                          checked
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted",
                        )}
                      >
                        <Checkbox checked={checked} className="pointer-events-none" />
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {availableCategories.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">No categories. Ask admin to add some.</div>
                    ) : availableCategories.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        <span className="flex items-center gap-2">
                          {c.name}
                          <span className="flex gap-1">
                            {c.from.map((f) => (
                              <Badge key={f} variant="outline" className="text-[10px] px-1 py-0 h-4">{f}</Badge>
                            ))}
                          </span>
                        </span>
                      </SelectItem>
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
            <span>Ticket # will be auto-generated</span>
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
