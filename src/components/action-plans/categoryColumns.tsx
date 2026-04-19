import { CheckCircle2, Circle, AlertTriangle, ThumbsUp, ThumbsDown } from "lucide-react";
import type { ActionPlan, ActionPlanCategory } from "@/hooks/useActionPlans";
import type { PlanStepSummary } from "@/hooks/usePlanStepSummaries";

/**
 * Markers used by the "Add Update" templates in AddUpdateForm.tsx.
 * Keep in sync with that file — these strings are what the renderer
 * scans timeline notes for.
 */
const MARKER_WARNING_EMAIL = "📧 **Warning Email Sent**";
const MARKER_MEETING_SCHEDULED = "📅 **Evaluation Meeting Scheduled**";
const MARKER_MEETING_FOLLOWUP = "📝 **Meeting Follow-up**";

export interface CategoryColumnSpec {
  /** Header label shown in the table */
  header: string;
  /** Aggregates a tutor's plans into a per-cell value (count of plans where this milestone is true) */
  compute: (plans: ActionPlan[], stepSummaries: Record<string, PlanStepSummary>) => {
    done: number;
    total: number;
    /** Optional small icon hint for the cell */
    tone: "neutral" | "good" | "warn" | "bad";
  };
}

/** Helper: count plans whose timeline notes contain ANY of the given markers. */
const countWithMarker = (
  plans: ActionPlan[],
  stepSummaries: Record<string, PlanStepSummary>,
  marker: string,
) =>
  plans.filter((p) => (stepSummaries[p.id]?.notes ?? []).some((n) => n.includes(marker))).length;

const warningEmailCol: CategoryColumnSpec = {
  header: "Warning email",
  compute: (plans, sums) => {
    const done = countWithMarker(plans, sums, MARKER_WARNING_EMAIL);
    return { done, total: plans.length, tone: done === 0 ? "warn" : "good" };
  },
};

const meetingScheduledCol: CategoryColumnSpec = {
  header: "Meeting scheduled",
  compute: (plans, sums) => {
    const done = countWithMarker(plans, sums, MARKER_MEETING_SCHEDULED);
    return { done, total: plans.length, tone: done === 0 ? "warn" : "good" };
  },
};

const meetingConductedCol: CategoryColumnSpec = {
  header: "Meeting conducted",
  compute: (plans, sums) => {
    const done = countWithMarker(plans, sums, MARKER_MEETING_FOLLOWUP);
    return { done, total: plans.length, tone: done === 0 ? "neutral" : "good" };
  },
};

const escalatedHrCol: CategoryColumnSpec = {
  header: "Escalated to HR",
  compute: (plans, sums) => {
    // Count plans currently escalated, but use total historical escalation events for the badge.
    const events = plans.reduce((acc, p) => acc + (sums[p.id]?.escalationCount ?? 0), 0);
    const currentlyEscalated = plans.filter((p) => p.status === "escalated").length;
    // "done" represents the count we want to display; total stays as plan count for context.
    return { done: events, total: plans.length, tone: events > 0 || currentlyEscalated > 0 ? "bad" : "neutral" };
  },
};

const evaluationCol: CategoryColumnSpec = {
  header: "Evaluation",
  compute: (plans) => {
    const improved = plans.filter((p) => p.evaluation === "improved").length;
    const not = plans.filter((p) => p.evaluation === "not_improved").length;
    const done = improved + not;
    return {
      done,
      total: plans.length,
      tone: done === 0 ? "neutral" : not > improved ? "bad" : "good",
    };
  },
};

/** Specialised column sets per category. When category === "all", we fall back to generic columns. */
export const CATEGORY_COLUMNS: Partial<Record<ActionPlanCategory, CategoryColumnSpec[]>> = {
  quality: [meetingScheduledCol, meetingConductedCol, evaluationCol, escalatedHrCol],
  emergency_abuse: [warningEmailCol, meetingConductedCol, escalatedHrCol],
  no_show_abuse: [warningEmailCol, meetingConductedCol, escalatedHrCol],
  communication: [meetingScheduledCol, meetingConductedCol, evaluationCol],
  cs_complaints: [meetingScheduledCol, meetingConductedCol, evaluationCol, escalatedHrCol],
};

/** Special rendering for the Evaluation column — show improved/not split. */
export const EvaluationCell = ({ plans }: { plans: ActionPlan[] }) => {
  const improved = plans.filter((p) => p.evaluation === "improved").length;
  const not = plans.filter((p) => p.evaluation === "not_improved").length;
  if (improved === 0 && not === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
      {improved > 0 && (
        <span className="inline-flex items-center gap-0.5 text-green-600 font-medium">
          <ThumbsUp className="w-3 h-3" /> {improved}
        </span>
      )}
      {improved > 0 && not > 0 && <span className="text-muted-foreground">/</span>}
      {not > 0 && (
        <span className="inline-flex items-center gap-0.5 text-destructive font-medium">
          <ThumbsDown className="w-3 h-3" /> {not}
        </span>
      )}
    </span>
  );
};

/** Generic done/total cell with tone-coloured icon. */
export const MilestoneCell = ({
  done,
  total,
  tone,
}: {
  done: number;
  total: number;
  tone: "neutral" | "good" | "warn" | "bad";
}) => {
  if (total === 0) return <span className="text-muted-foreground">—</span>;
  const allDone = done === total;
  const noneDone = done === 0;

  const Icon = tone === "bad" ? AlertTriangle : allDone ? CheckCircle2 : noneDone ? Circle : CheckCircle2;
  const colour =
    tone === "bad"
      ? "text-destructive"
      : tone === "warn" && noneDone
        ? "text-orange-600"
        : allDone
          ? "text-green-600"
          : noneDone
            ? "text-muted-foreground"
            : "text-blue-600";

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colour}`}>
      <Icon className="w-3.5 h-3.5" />
      {done}
      {total > 1 && <span className="text-muted-foreground">/{total}</span>}
    </span>
  );
};
