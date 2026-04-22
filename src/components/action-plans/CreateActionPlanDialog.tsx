import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CATEGORY_LABELS, SELECTABLE_CATEGORIES, useActionPlanTutors, type ActionPlanCategory } from "@/hooks/useActionPlans";
import { teamLeaderMatches } from "@/lib/teamLeaderMatch";
import { CategoryDecisionHelper } from "./CategoryDecisionHelper";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  isAdmin: boolean;
  currentTeamLeader: string | null;
}

export function CreateActionPlanDialog({ open, onOpenChange, onCreated, isAdmin, currentTeamLeader }: Props) {
  const { tutors } = useActionPlanTutors();
  const [tutorId, setTutorId] = useState<string>("");
  const [category, setCategory] = useState<ActionPlanCategory>("quality");
  const [summary, setSummary] = useState("");
  const [days, setDays] = useState(30);
  const [baselineScore, setBaselineScore] = useState<string>("");
  const [tutorSearchOpen, setTutorSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Quality plans require a baseline score < 90 to be eligible.
  const baselineNum = baselineScore.trim() === "" ? null : Number(baselineScore);
  const baselineValid =
    baselineNum !== null && Number.isFinite(baselineNum) && baselineNum >= 0 && baselineNum <= 100;
  const qualityEligible = category !== "quality" || (baselineValid && (baselineNum as number) < 90);

  // Admins can pick any tutor; TLs only see their own (RLS already enforces)
  const visibleTutors = useMemo(() => {
    if (isAdmin) return tutors;
    return tutors.filter((t) => t.team_leader === currentTeamLeader);
  }, [tutors, isAdmin, currentTeamLeader]);

  const selectedTutor = visibleTutors.find((t) => t.id === tutorId);

  const reset = () => {
    setTutorId("");
    setCategory("quality");
    setSummary("");
    setDays(30);
    setBaselineScore("");
  };

  const handleSubmit = async () => {
    if (!selectedTutor) {
      toast.error("Please select a tutor");
      return;
    }
    if (category === "quality") {
      if (!baselineValid) {
        toast.error("Enter a baseline quality score (0–100) for this month");
        return;
      }
      if ((baselineNum as number) >= 90) {
        toast.error("Quality action plan not required", {
          description: "Baseline score must be below 90 to open a Quality action plan.",
        });
        return;
      }
    }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Not authenticated");
      setSaving(false);
      return;
    }
    const start = new Date();
    const due = new Date();
    due.setDate(due.getDate() + days);

    const { error } = await supabase.from("action_plans").insert({
      tutor_name: selectedTutor.tutor_name,
      tutor_external_id: selectedTutor.tutor_external_id,
      team_leader: selectedTutor.team_leader,
      category,
      summary: summary || null,
      start_date: start.toISOString().slice(0, 10),
      due_date: due.toISOString().slice(0, 10),
      created_by: session.user.id,
      quality_baseline_score: category === "quality" ? baselineNum : null,
    });

    setSaving(false);
    if (error) {
      toast.error("Failed to create action plan", { description: error.message });
      return;
    }
    toast.success("Action plan created");
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Action Plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tutor</Label>
            <Popover open={tutorSearchOpen} onOpenChange={setTutorSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {selectedTutor
                    ? `${selectedTutor.tutor_name}${selectedTutor.tutor_external_id ? ` (${selectedTutor.tutor_external_id})` : ""}`
                    : "Select tutor..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search tutor..." />
                  <CommandList>
                    <CommandEmpty>No tutor found.</CommandEmpty>
                    <CommandGroup>
                      {visibleTutors.map((t) => (
                        <CommandItem
                          key={t.id}
                          value={`${t.tutor_name} ${t.tutor_external_id ?? ""} ${t.team_leader}`}
                          onSelect={() => {
                            setTutorId(t.id);
                            setTutorSearchOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", tutorId === t.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col">
                            <span>{t.tutor_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {t.tutor_external_id} · {t.team_leader}
                            </span>
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
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ActionPlanCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SELECTABLE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CategoryDecisionHelper category={category} />

          {category === "quality" && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/20">
              <Label className="text-sm font-semibold">
                Baseline Quality Score (this month) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                placeholder="e.g. 78"
                value={baselineScore}
                onChange={(e) => setBaselineScore(e.target.value)}
                className={baselineScore && !qualityEligible ? "border-destructive" : ""}
              />
              {baselineScore.trim() === "" ? (
                <p className="text-xs text-muted-foreground">
                  Enter the tutor's quality score for the current month. A Quality action plan is
                  only required when the score is <strong>below 90</strong>.
                </p>
              ) : !baselineValid ? (
                <p className="text-xs text-destructive">Score must be a number between 0 and 100.</p>
              ) : (baselineNum as number) >= 90 ? (
                <p className="text-xs text-destructive">
                  Score is {baselineNum}. No Quality action plan is needed (≥ 90). Choose another
                  category or wait until the score drops below 90.
                </p>
              ) : (
                <p className="text-xs text-green-600 dark:text-green-500">
                  ✓ Eligible. Baseline {baselineNum} will be tracked for the next 3 months.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Duration (days)</Label>
            <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value) || 30)} />
            <p className="text-xs text-muted-foreground">Default 30 days from today.</p>
          </div>

          <div className="space-y-2">
            <Label>Summary (optional)</Label>
            <Textarea
              placeholder="Brief description of the issue and expected outcome..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !tutorId || !qualityEligible}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
