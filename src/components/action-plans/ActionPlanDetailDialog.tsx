import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, XCircle, Calendar, User, AlertCircle, Trash2, Pencil, Check, X, Flag } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { CategoryBadge, StatusBadge } from "./ActionPlanBadges";
import { CategoryDecisionHelper } from "./CategoryDecisionHelper";
import { AddUpdateForm } from "./AddUpdateForm";
import { StepNoteRenderer } from "./StepNoteRenderer";
import { PlanProgressTracker } from "./PlanProgressTracker";
import { PlanRoadmap } from "./PlanRoadmap";
import { QualityScoresEditor } from "./QualityScoresEditor";
import { isFirstStepDone } from "./categoryFirstStep";
import {
  useActionPlanSteps,
  type ActionPlan,
  type ActionPlanEvaluation,
  type ActionPlanStatus,
} from "@/hooks/useActionPlans";

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
  const { isAdmin } = useUserRole();
  const [savingEval, setSavingEval] = useState(false);
  const [evalNotes, setEvalNotes] = useState("");
  // Local mirror of the plan so header/progress refresh in-place after edits.
  const [currentPlan, setCurrentPlan] = useState<ActionPlan | null>(plan);
  // Current user (to gate per-step edit/delete to author or admin).
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Per-step edit / delete state.
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [stepToDelete, setStepToDelete] = useState<{ id: string; preview: string } | null>(null);
  const [deletingStep, setDeletingStep] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user.id ?? null);
    });
  }, []);

  useEffect(() => {
    setCurrentPlan(plan);
    setEvalNotes(plan?.evaluation_notes ?? "");
  }, [plan?.id, plan?.evaluation_notes, plan?.status, plan?.progress, plan?.evaluation, plan]);

  if (!currentPlan) return null;

  const isResolved = currentPlan.status === "resolved";
  const dueDate = new Date(currentPlan.due_date);
  const isOverdue = !isResolved && dueDate < new Date();

  const handlePosted = (planUpdates: Partial<{ status: ActionPlanStatus; progress: number; resolved_at: string }>) => {
    if (Object.keys(planUpdates).length > 0) {
      setCurrentPlan((prev) => (prev ? { ...prev, ...planUpdates } as ActionPlan : prev));
    }
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

  const startEditStep = (stepId: string, currentNote: string) => {
    setEditingStepId(stepId);
    setEditText(currentNote);
  };
  const cancelEditStep = () => {
    setEditingStepId(null);
    setEditText("");
  };
  const saveEditStep = async (stepId: string) => {
    const trimmed = editText.trim();
    if (!trimmed) {
      toast.error("Note cannot be empty");
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from("action_plan_steps")
      .update({ note: trimmed })
      .eq("id", stepId);
    setSavingEdit(false);
    if (error) {
      toast.error("Failed to update step", { description: error.message });
      return;
    }
    toast.success("Update edited");
    setEditingStepId(null);
    setEditText("");
    refetchSteps();
  };
  const confirmDeleteStep = async () => {
    if (!stepToDelete) return;
    setDeletingStep(true);
    const { error } = await supabase
      .from("action_plan_steps")
      .delete()
      .eq("id", stepToDelete.id);
    setDeletingStep(false);
    if (error) {
      toast.error("Failed to delete step", { description: error.message });
      return;
    }
    toast.success("Step deleted");
    setStepToDelete(null);
    refetchSteps();
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

          {/* First-step tracker (admin/TL clear visibility) */}
          <PlanProgressTracker
            category={currentPlan.category}
            totalSteps={steps.length}
            firstStepDone={isFirstStepDone(currentPlan.category, steps.map((s) => s.note))}
          />

          {/* Vertical roadmap of recommended steps for this category */}
          <PlanRoadmap
            category={currentPlan.category}
            notes={steps.map((s) => s.note)}
            status={currentPlan.status}
            totalUpdates={steps.length}
          />

          {/* Decision helper for this category */}
          <CategoryDecisionHelper category={currentPlan.category} />

          {/* Quality scores: only relevant for the Quality category. */}
          {currentPlan.category === "quality" && (
            <QualityScoresEditor
              plan={currentPlan}
              onSaved={(updates) =>
                setCurrentPlan((prev) => (prev ? ({ ...prev, ...updates } as ActionPlan) : prev))
              }
            />
          )}

          <Separator />

          {/* Timeline */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Timeline</h3>
              {(() => {
                const totalEscalations = steps.filter((s) => s.status_change === "escalated").length;
                if (totalEscalations === 0) return null;
                return (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                    <Flag className="w-3 h-3" fill="currentColor" />
                    {totalEscalations === 1
                      ? "Escalated once"
                      : `Escalated ${totalEscalations}× (re-escalated)`}
                  </span>
                );
              })()}
            </div>
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2">
              {steps.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No updates yet.</p>
              )}
              {(() => {
                // Steps are already ordered by created_at asc → assign running escalation #
                let escIndex = 0;
                return steps.map((s) => {
                  const isEscalation = s.status_change === "escalated";
                  if (isEscalation) escIndex += 1;
                  const escNumber = isEscalation ? escIndex : null;
                  const canEditStep = isAdmin || (currentUserId !== null && s.author_id === currentUserId);
                  const isEditing = editingStepId === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`pl-3 py-1 group ${
                        isEscalation
                          ? "border-l-2 border-destructive bg-destructive/5 rounded-r-md -mr-2 pr-2"
                          : "border-l-2 border-primary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1 gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-foreground truncate">{s.author_name || "User"}</span>
                          {isEscalation && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground text-[10px] font-semibold uppercase tracking-wide">
                              <Flag className="w-3 h-3" fill="currentColor" />
                              Escalation #{escNumber}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{format(new Date(s.created_at), "MMM d, yyyy · HH:mm")}</span>
                          {canEditStep && !isEditing && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => startEditStep(s.id, s.note)}
                                title="Edit update"
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() =>
                                  setStepToDelete({ id: s.id, preview: s.note.slice(0, 80) })
                                }
                                title="Delete update"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={2}
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveEditStep(s.id)}
                              disabled={savingEdit}
                            >
                              {savingEdit ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3 mr-1" />
                              )}
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditStep}
                              disabled={savingEdit}
                            >
                              <X className="w-3 h-3 mr-1" /> Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <StepNoteRenderer text={s.note} />
                      )}
                      {!isEditing && (s.status_change || s.progress_change !== null) && (
                        <div className="flex gap-2 mt-2 text-xs">
                          {s.status_change && <StatusBadge status={s.status_change} />}
                          {s.progress_change !== null && (
                            <span className="px-2 py-0.5 rounded bg-muted">Progress → {s.progress_change}%</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Add update with templates */}
          {!isResolved && (
            <AddUpdateForm
              planId={currentPlan.id}
              category={currentPlan.category}
              currentStatus={currentPlan.status}
              currentProgress={currentPlan.progress}
              firstStepDone={isFirstStepDone(currentPlan.category, steps.map((s) => s.note))}
              onPosted={handlePosted}
            />
          )}

          {/* Evaluation (only for resolved) */}
          {isResolved && (
            <div className="space-y-3 border rounded-md p-3 bg-muted/20">
              <Label className="text-sm font-semibold">Final Evaluation</Label>
              {currentPlan.evaluation && (
                <p className="text-sm">
                  Current: <strong>{currentPlan.evaluation === "improved" ? "Improved" : "Not Improved"}</strong>
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

      <AlertDialog
        open={!!stepToDelete}
        onOpenChange={(v) => !v && !deletingStep && setStepToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this update?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the timeline update. This cannot be undone.
              {stepToDelete?.preview && (
                <span className="block mt-2 italic text-foreground">
                  "{stepToDelete.preview}{stepToDelete.preview.length >= 80 ? "…" : ""}"
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingStep}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteStep(); }}
              disabled={deletingStep}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingStep ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
