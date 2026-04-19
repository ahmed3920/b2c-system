import { CheckCircle2, Circle, AlertTriangle, ThumbsUp, ThumbsDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
    const events = plans.reduce((acc, p) => acc + (sums[p.id]?.escalationCount ?? 0), 0);
    const currentlyEscalated = plans.filter((p) => p.status === "escalated").length;
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

/**
 * Quality-only score columns. Rendered by the table with `QualityScoreCell`
 * (the renderer in ActionPlans.tsx branches on `header` matching one of these).
 * `compute` is intentionally a no-op for these columns.
 */
export const QUALITY_SCORE_HEADERS = {
  baseline: "Baseline",
  m1: "Month 1",
  m2: "Month 2",
  m3: "Month 3",
} as const;

const noopCompute = () => ({ done: 0, total: 0, tone: "neutral" as const });

const baselineCol: CategoryColumnSpec = { header: QUALITY_SCORE_HEADERS.baseline, compute: noopCompute };
const m1Col: CategoryColumnSpec = { header: QUALITY_SCORE_HEADERS.m1, compute: noopCompute };
const m2Col: CategoryColumnSpec = { header: QUALITY_SCORE_HEADERS.m2, compute: noopCompute };
const m3Col: CategoryColumnSpec = { header: QUALITY_SCORE_HEADERS.m3, compute: noopCompute };

/** Specialised column sets per category. When category === "all", we fall back to generic columns. */
export const CATEGORY_COLUMNS: Partial<Record<ActionPlanCategory, CategoryColumnSpec[]>> = {
  quality: [
    meetingScheduledCol,
    meetingConductedCol,
    evaluationCol,
    escalatedHrCol,
    baselineCol,
    m1Col,
    m2Col,
    m3Col,
  ],
  emergency_abuse: [warningEmailCol, meetingConductedCol, escalatedHrCol],
  no_show_abuse: [warningEmailCol, meetingConductedCol, escalatedHrCol],
  communication: [meetingScheduledCol, meetingConductedCol, evaluationCol],
  cs_complaints: [meetingScheduledCol, meetingConductedCol, evaluationCol, escalatedHrCol],
};

/**
 * Quality score cell — averages the score across the tutor's plans for that
 * column (baseline / M1 / M2 / M3) and shows ▲/▼ vs baseline average.
 * If only one plan, it's just that plan's value.
 */
export const QualityScoreCell = ({
  plans,
  field,
}: {
  plans: ActionPlan[];
  field: "quality_baseline_score" | "quality_month1_score" | "quality_month2_score" | "quality_month3_score";
}) => {
  const values = plans
    .map((p) => p[field])
    .filter((v): v is number => v !== null && Number.isFinite(v));

  if (values.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  // Baseline cell: just show the value (no delta).
  if (field === "quality_baseline_score") {
    return (
      <span className="inline-flex flex-col items-center text-xs">
        <span className="font-semibold tabular-nums">{avg.toFixed(1)}</span>
        {plans.length > 1 && <span className="text-[10px] text-muted-foreground">avg of {values.length}</span>}
      </span>
    );
  }

  // Follow-up cells: compute delta vs baseline (averaged the same way, only over the
  // plans that have BOTH this month's score and a baseline — fairest comparison).
  const paired = plans
    .map((p) => ({ base: p.quality_baseline_score, follow: p[field] }))
    .filter((x) => x.base !== null && x.follow !== null && Number.isFinite(x.base) && Number.isFinite(x.follow)) as { base: number; follow: number }[];

  let delta: number | null = null;
  if (paired.length > 0) {
    const baseAvg = paired.reduce((a, b) => a + b.base, 0) / paired.length;
    const followAvg = paired.reduce((a, b) => a + b.follow, 0) / paired.length;
    delta = followAvg - baseAvg;
  }

  const tone = delta === null ? "neutral" : delta > 0 ? "good" : delta < 0 ? "bad" : "neutral";
  const colour = tone === "good" ? "text-green-600" : tone === "bad" ? "text-destructive" : "text-muted-foreground";
  const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  return (
    <span className="inline-flex flex-col items-center text-xs">
      <span className="font-semibold tabular-nums">{avg.toFixed(1)}</span>
      {delta !== null && (
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${colour}`}>
          <Icon className="w-3 h-3" />
          {delta > 0 ? "+" : ""}{delta.toFixed(1)}
        </span>
      )}
    </span>
  );
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
