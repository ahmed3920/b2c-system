import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
// Input no longer needed: progress is auto-calculated
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, MessageSquarePlus, CheckCircle2, XCircle, Calendar, User, AlertCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { CategoryBadge, StatusBadge } from "./ActionPlanBadges";
import { CategoryDecisionHelper } from "./CategoryDecisionHelper";
import {
  STATUS_LABELS,
  useActionPlanSteps,
  type ActionPlan,
  type ActionPlanEvaluation,
  type ActionPlanStatus,
} from "@/hooks/useActionPlans";

// Auto-progress mapping based on status
const STATUS_PROGRESS: Record<ActionPlanStatus, number> = {
  active: 25,
  on_hold: 25,
  escalated: 60,
  resolved: 100,
};

interface Props {
  plan: ActionPlan | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
  onDelete?: (plan: ActionPlan) => void;
  canDelete?: boolean;
}

export function ActionPlanDetailDialog({ plan, open, onOpenChange, onChanged, onDelete, canDelete }: Props) {
  const { steps, refetch: refetchSteps } = useActionPlanSteps(plan?.id ?? null);
  const [note, setNote] = useState("");
  const [statusChange, setStatusChange] = useState<ActionPlanStatus | "none">("none");
  const [posting, setPosting] = useState(false);
  const [savingEval, setSavingEval] = useState(false);
  const [evalNotes, setEvalNotes] = useState("");
  // Local mirror of the plan so header/progress refresh in-place after edits.
  const [currentPlan, setCurrentPlan] = useState<ActionPlan | null>(plan);

  useEffect(() => {
    setCurrentPlan(plan);
    setEvalNotes(plan?.evaluation_notes ?? "");
  }, [plan?.id, plan?.evaluation_notes, plan?.status, plan?.progress, plan?.evaluation, plan]);

  if (!currentPlan) return null;

  const isResolved = currentPlan.status === "resolved";
  const dueDate = new Date(currentPlan.due_date);
  const isOverdue = !isResolved && dueDate < new Date();

  const postUpdate = async () => {
    if (!note.trim()) {
      toast.error("Please add a note");
      return;
    }
    setPosting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, mentor_name")
      .eq("user_id", session.user.id)
      .single();

    const newStatus = statusChange !== "none" ? statusChange : null;
    // Compute auto progress: prefer new status mapping if status changes,
    // otherwise nudge progress upward by 10% per posted update (capped at 90% until resolved).
    let autoProgress: number | null = null;
    if (newStatus) {
      autoProgress = STATUS_PROGRESS[newStatus];
    } else if (currentPlan.status !== "resolved") {
      autoProgress = Math.min(90, currentPlan.progress + 10);
    }

    // Insert step
    const { error: stepErr } = await supabase.from("action_plan_steps").insert({
      plan_id: currentPlan.id,
      author_id: session.user.id,
      author_name: profile?.full_name || profile?.mentor_name || "User",
      note: note.trim(),
      status_change: newStatus,
      progress_change: autoProgress,
    });
    if (stepErr) {
      toast.error("Failed to post update", { description: stepErr.message });
      setPosting(false);
      return;
    }

    // Apply changes to plan if any
    const planUpdates: Partial<ActionPlan> = {};
    if (newStatus) {
      planUpdates.status = newStatus;
      if (newStatus === "resolved") planUpdates.resolved_at = new Date().toISOString();
    }
    if (autoProgress !== null) planUpdates.progress = autoProgress;

    if (Object.keys(planUpdates).length > 0) {
      const { error: planErr } = await supabase.from("action_plans").update(planUpdates).eq("id", currentPlan.id);
      if (planErr) {
        toast.error("Update saved but plan change failed", { description: planErr.message });
      } else {
        // Reflect changes in the dialog immediately.
        setCurrentPlan((prev) => (prev ? { ...prev, ...planUpdates } as ActionPlan : prev));
      }
    }

    toast.success("Update posted");
    setNote("");
    setStatusChange("none");
    setPosting(false);
    refetchSteps();
    onChanged();
  };

  const setEvaluation = async (evaluation: ActionPlanEvaluation) => {
    setSavingEval(true);
    const { error } = await supabase
      .from("action_plans")
      .update({ evaluation, evaluation_notes: evalNotes || null })
      .eq("id", currentPlan.id);
    setSavingEval(false);
    if (error) {
      toast.error("Failed to save evaluation", { description: error.message });
      return;
    }
    setCurrentPlan((prev) => (prev ? { ...prev, evaluation, evaluation_notes: evalNotes || null } : prev));
    toast.success("Evaluation saved");
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap pr-8">
            <span>{currentPlan.tutor_name}</span>
            <CategoryBadge category={currentPlan.category} />
            <StatusBadge status={currentPlan.status} />
            {isOverdue && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Overdue
              </span>
            )}
            {canDelete && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(currentPlan)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Team Leader</p>
              <p className="font-medium flex items-center gap-1"><User className="w-3 h-3" />{currentPlan.team_leader}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Tutor ID</p>
              <p className="font-medium">{currentPlan.tutor_external_id || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Start</p>
              <p className="font-medium flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(currentPlan.start_date), "MMM d, yyyy")}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Due</p>
              <p className={`font-medium flex items-center gap-1 ${isOverdue ? "text-destructive" : ""}`}>
                <Calendar className="w-3 h-3" />{format(new Date(currentPlan.due_date), "MMM d, yyyy")}
              </p>
            </div>
          </div>

          {currentPlan.summary && (
            <div className="bg-muted/40 rounded-md p-3 text-sm">
              <p className="text-muted-foreground text-xs mb-1">Summary</p>
              <p>{currentPlan.summary}</p>
            </div>
          )}

          {/* Progress (auto-calculated) */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Progress <span className="text-xs text-muted-foreground">(auto)</span></span>
              <span className="font-bold">{currentPlan.progress}%</span>
            </div>
            <Progress value={currentPlan.progress} className="h-2" />
          </div>

          {/* Decision helper for this category */}
          <CategoryDecisionHelper category={currentPlan.category} />

          <Separator />

          {/* Timeline */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Timeline</h3>
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2">
              {steps.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No updates yet.</p>
              )}
              {steps.map((s) => (
                <div key={s.id} className="border-l-2 border-primary/30 pl-3 py-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span className="font-medium text-foreground">{s.author_name || "User"}</span>
                    <span>{format(new Date(s.created_at), "MMM d, yyyy · HH:mm")}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{s.note}</p>
                  {(s.status_change || s.progress_change !== null) && (
                    <div className="flex gap-2 mt-2 text-xs">
                      {s.status_change && <StatusBadge status={s.status_change} />}
                      {s.progress_change !== null && (
                        <span className="px-2 py-0.5 rounded bg-muted">Progress → {s.progress_change}%</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add update */}
          {!isResolved && (
            <div className="space-y-3 border rounded-md p-3 bg-muted/20">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4" /> Add Update
              </Label>
              <Textarea
                placeholder="What happened? What's next?"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div>
                <Label className="text-xs">Change status (optional)</Label>
                <Select value={statusChange} onValueChange={(v) => setStatusChange(v as ActionPlanStatus | "none")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No change</SelectItem>
                    {(Object.keys(STATUS_LABELS) as ActionPlanStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Progress is updated automatically based on status and posted updates.
                </p>
              </div>
              <Button onClick={postUpdate} disabled={posting} size="sm">
                {posting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Post Update
              </Button>
            </div>
          )}

          {/* Evaluation (only for resolved) */}
          {isResolved && (
            <div className="space-y-3 border rounded-md p-3 bg-muted/20">
              <Label className="text-sm font-semibold">Final Evaluation</Label>
              {plan.evaluation && (
                <p className="text-sm">
                  Current: <strong>{plan.evaluation === "improved" ? "Improved" : "Not Improved"}</strong>
                </p>
              )}
              <Textarea
                placeholder="Evaluation notes..."
                rows={2}
                value={evalNotes}
                onChange={(e) => setEvalNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEvaluation("improved")}
                  disabled={savingEval}
                  className="border-green-500/50 text-green-600 hover:bg-green-500/10"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Improved
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEvaluation("not_improved")}
                  disabled={savingEval}
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <XCircle className="w-4 h-4 mr-1" /> Not Improved
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
