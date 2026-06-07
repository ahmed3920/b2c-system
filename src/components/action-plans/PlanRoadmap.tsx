import { CheckCircle2, Circle, Mail, CalendarClock, FileText, AlertTriangle, MessageSquare, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionPlanCategory } from "@/hooks/useActionPlans";

export type RoadmapStepKind =
  | "warning_email"
  | "schedule_meeting"
  | "meeting_followup"
  | "monitor"
  | "escalate";

export interface RoadmapStep {
  kind: RoadmapStepKind;
  label: string;
  detail?: string;
  /** Substring(s) — if any appear in any posted note, the step is considered done. */
  matchMarkers?: string[];
  /** If true, step ticks when plan.status === "escalated" or "resolved". */
  matchEscalated?: boolean;
  /** If true, step ticks when at least N updates have been posted. */
  matchUpdatesAtLeast?: number;
  /** Visually highlights the step as a primary/main action. */
  isMain?: boolean;
}

const ICONS: Record<RoadmapStepKind, React.ElementType> = {
  warning_email: Mail,
  schedule_meeting: CalendarClock,
  meeting_followup: FileText,
  monitor: MessageSquare,
  escalate: AlertTriangle,
};

const ROADMAPS: Record<ActionPlanCategory, RoadmapStep[]> = {
  emergency_abuse: [
    { kind: "warning_email", label: "Send warning email", detail: "Document the email with subject, recipient, date and screenshot.", matchMarkers: ["📧 **Warning Email Sent**"] },
    { kind: "schedule_meeting", label: "Schedule meeting (after 3rd request)", detail: "Required after the 3rd request after 2:00 PM.", matchMarkers: ["📅 **Evaluation Meeting Scheduled**"] },
    { kind: "meeting_followup", label: "Log meeting follow-up", detail: "Add meeting notes and recording link.", matchMarkers: ["📝 **Meeting Follow-up**"] },
    { kind: "escalate", label: "Escalate to HR if abuse continues", detail: "More than 3 requests → HR action plan.", matchEscalated: true },
  ],
  no_show_abuse: [
    { kind: "warning_email", label: "Send warning email (1st no-show)", detail: "1 warning + 2x deduction.", matchMarkers: ["📧 **Warning Email Sent**"] },
    { kind: "schedule_meeting", label: "Schedule meeting (2nd no-show)", detail: "3x deduction + warning + meeting.", matchMarkers: ["📅 **Evaluation Meeting Scheduled**"] },
    { kind: "meeting_followup", label: "Log meeting follow-up", matchMarkers: ["📝 **Meeting Follow-up**"] },
    { kind: "escalate", label: "Direct to HR (3–4 no-shows)", matchEscalated: true },
  ],
  quality: [
    { kind: "warning_email", label: "Send warning email", detail: "Email outlining concerns and required improvements expected from the tutor.", matchMarkers: ["📧 **Warning Email Sent**"], isMain: true },
    { kind: "schedule_meeting", label: "Schedule evaluation meeting", detail: "Main step — must be conducted with the tutor.", matchMarkers: ["📅 **Evaluation Meeting Scheduled**"], isMain: true },
    { kind: "meeting_followup", label: "Log meeting notes & recording", matchMarkers: ["📝 **Meeting Follow-up**"] },
    { kind: "monitor", label: "Set follow-up review (≈2 weeks)", detail: "Add a free-note update with the chosen follow-up date.", matchUpdatesAtLeast: 3 },
    { kind: "escalate", label: "Re-evaluate quality score", detail: "Resolve plan with Improved / Not Improved evaluation.", matchEscalated: true },
  ],
  cs_complaints: [
    { kind: "warning_email", label: "Send warning email", detail: "Email to the tutor including the CS ticket details and the concern raised.", matchMarkers: ["📧 **Warning Email Sent**"], isMain: true },
    { kind: "schedule_meeting", label: "Schedule evaluation meeting", detail: "Triggered from the 2nd repeated CS ticket in the same month.", matchMarkers: ["📅 **Evaluation Meeting Scheduled**"] },
    { kind: "meeting_followup", label: "Document root cause & corrective steps", matchMarkers: ["📝 **Meeting Follow-up**"] },
    { kind: "monitor", label: "Monitor CS tickets for the rest of the month", matchUpdatesAtLeast: 3 },
    { kind: "escalate", label: "Escalate to HR after 3 repeated incidents", detail: "If the same issue repeats 3 times, escalate the case to HR.", matchEscalated: true, isMain: true },
  ],
  communication: [
    { kind: "warning_email", label: "1st violation — Send formal warning email", detail: "Document the formal warning email sent to the tutor for the first violation.", matchMarkers: ["📧 **Warning Email Sent**"], isMain: true },
    { kind: "monitor", label: "Monitor channels for 2 weeks", detail: "Add a free-note update with the follow-up date and observations.", matchUpdatesAtLeast: 2 },
    { kind: "warning_email", label: "2nd violation — Warning email + schedule evaluation meeting", detail: "Send a second formal warning email and schedule an evaluation meeting to discuss the behavior and its impact.", matchMarkers: ["📅 **Evaluation Meeting Scheduled**"], isMain: true },
    { kind: "meeting_followup", label: "Log follow-up meeting notes", detail: "Document the meeting outcomes, agreed actions and recording link.", matchMarkers: ["📝 **Meeting Follow-up**"] },
    { kind: "escalate", label: "3rd violation — Financial deduction & escalate to HR", detail: "Apply the financial deduction and escalate to HR for further disciplinary action.", matchEscalated: true, isMain: true },
  ],
  study_neglect: [
    { kind: "warning_email", label: "Send warning email", detail: "Email naming the unstudied module(s) and assigned deadline.", matchMarkers: ["📧 **Warning Email Sent**"], isMain: true },
    { kind: "schedule_meeting", label: "Schedule meeting to discuss reason", detail: "Understand why the modules were not studied and reset expectations.", matchMarkers: ["📅 **Evaluation Meeting Scheduled**"] },
    { kind: "meeting_followup", label: "Log meeting notes & new study deadline", matchMarkers: ["📝 **Meeting Follow-up**"] },
    { kind: "monitor", label: "Verify modules completed (quiz / knowledge check)", matchUpdatesAtLeast: 3 },
    { kind: "escalate", label: "Escalate to HR after 3rd repeat", detail: "Escalate when the tutor neglects assigned modules a 3rd time.", matchEscalated: true },
  ],
  leaves_abuse: [],
};

interface Props {
  category: ActionPlanCategory;
  notes: string[];
  status: string;
  totalUpdates: number;
}

export function PlanRoadmap({ category, notes, status, totalUpdates }: Props) {
  const steps = ROADMAPS[category];
  if (!steps || steps.length === 0) return null;

  const isDone = (step: RoadmapStep): boolean => {
    if (step.matchMarkers?.some((m) => notes.some((n) => n.includes(m)))) return true;
    if (step.matchEscalated && (status === "escalated" || status === "resolved")) return true;
    if (step.matchUpdatesAtLeast && totalUpdates >= step.matchUpdatesAtLeast) return true;
    return false;
  };

  const completed = steps.filter(isDone).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Recommended Roadmap</h3>
        <span className="text-xs text-muted-foreground">
          {completed} of {steps.length} done · {pct}%
        </span>
      </div>
      {category === "quality" && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
          <RefreshCw className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p>
            <strong>Repeat monthly:</strong> this roadmap is followed every month for 3 months.
            If the follow-up score stays <strong>below the baseline</strong>, repeat the meeting
            and steps again the next month — continue until the score improves.
          </p>
        </div>
      )}
      <ol className="relative space-y-3">
        {steps.map((step, i) => {
          const done = isDone(step);
          const Icon = ICONS[step.kind];
          const isLast = i === steps.length - 1;
          return (
            <li key={i} className="relative flex gap-3 pb-1">
              {/* Connector line */}
              {!isLast && (
                <span
                  className={cn(
                    "absolute left-[11px] top-6 bottom-0 w-px",
                    done ? "bg-green-500/40" : "bg-border",
                  )}
                />
              )}
              {/* Status bubble */}
              <div
                className={cn(
                  "relative z-10 flex items-center justify-center w-6 h-6 rounded-full shrink-0 border",
                  done
                    ? "bg-green-500/15 border-green-500/40 text-green-700"
                    : "bg-muted border-border text-muted-foreground",
                )}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-3 h-3" />}
              </div>
              {/* Body */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon
                    className={cn(
                      "w-3.5 h-3.5 shrink-0",
                      done ? "text-green-600" : "text-muted-foreground",
                    )}
                  />
                  <p
                    className={cn(
                      "text-sm font-medium",
                      done && "line-through text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                  {step.isMain && (
                    <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
                      Main step
                    </span>
                  )}
                </div>
                {step.detail && (
                  <p className="text-xs text-muted-foreground mt-0.5 ml-5">{step.detail}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
