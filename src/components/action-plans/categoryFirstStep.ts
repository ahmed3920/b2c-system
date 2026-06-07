import type { ActionPlanCategory } from "@/hooks/useActionPlans";

export type FirstStepKind = "warning_email" | "schedule_meeting" | "meeting_followup";

export interface FirstStepSpec {
  kind: FirstStepKind;
  label: string;
  description: string;
  /** Marker that AddUpdateForm prepends to the note when this template is used. */
  marker: string;
}

/**
 * The required first action for each category. Used in the admin / detail view
 * to clearly show whether the tutor is still on step 1 or has progressed.
 */
export const CATEGORY_FIRST_STEP: Record<ActionPlanCategory, FirstStepSpec | null> = {
  emergency_abuse: {
    kind: "warning_email",
    label: "Send warning email",
    description: "Per emergency policy, the first action is a documented warning email to the tutor.",
    marker: "📧 **Warning Email Sent**",
  },
  no_show_abuse: {
    kind: "warning_email",
    label: "Send warning email",
    description: "First no-show requires a warning email + 2x deduction notice.",
    marker: "📧 **Warning Email Sent**",
  },
  quality: {
    kind: "warning_email",
    label: "Send warning email",
    description: "Send the tutor a warning email outlining concerns and the required improvements before scheduling the evaluation meeting.",
    marker: "📧 **Warning Email Sent**",
  },
  cs_complaints: {
    kind: "warning_email",
    label: "Send warning email",
    description: "Send the tutor a warning email containing the CS ticket details and the concern raised before scheduling further steps.",
    marker: "📧 **Warning Email Sent**",
  },
  communication: {
    kind: "schedule_meeting",
    label: "Schedule coaching conversation",
    description: "Communication plans should begin with a 1:1 coaching conversation.",
    marker: "📅 **Evaluation Meeting Scheduled**",
  },
  study_neglect: {
    kind: "warning_email",
    label: "Send warning email",
    description: "Send the tutor a warning email naming the unstudied module(s) and the assigned deadline before scheduling further follow-up.",
    marker: "📧 **Warning Email Sent**",
  },
  leaves_abuse: null,
};

/**
 * Detects whether the required first step has been completed by scanning the
 * posted timeline notes for the template marker.
 */
export function isFirstStepDone(
  category: ActionPlanCategory,
  notes: string[],
): boolean {
  const spec = CATEGORY_FIRST_STEP[category];
  if (!spec) return true; // No requirement → consider it satisfied
  return notes.some((n) => n.includes(spec.marker));
}
