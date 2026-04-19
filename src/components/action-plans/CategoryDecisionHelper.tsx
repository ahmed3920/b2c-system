import { useState } from "react";
import { ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionPlanCategory } from "@/hooks/useActionPlans";

interface HelperBlock {
  title: string;
  intro?: string;
  items: string[];
  footer?: string;
}

const HELPERS: Record<ActionPlanCategory, HelperBlock | null> = {
  emergency_abuse: {
    title: "Emergency Policy — Decision Helper",
    intro: "Deductions and penalties for each request within a single month:",
    items: [
      "1st request: Before/After 2:00 PM → Paid, No Action",
      "2nd request: Before 2:00 PM → 1x (Unpaid), Warning Email",
      "2nd request: After 2:00 PM → 2x, Warning Email",
      "3rd request: Before 2:00 PM → 2x, Warning Email",
      "3rd request: After 2:00 PM → 3x, Warning Email + Meeting",
      "More than 3 requests → Investigation, HR Action Plan",
    ],
  },
  no_show_abuse: {
    title: "No Show Policy — Decision Helper",
    intro: "If leave exceeds the limit (trigger):",
    items: [
      "1 no show → 1 warning + 2x deduction",
      "2 no shows → 3x deduction, warning + meeting",
      "3–4 no shows → direct to HR",
    ],
  },
  quality: {
    title: "Quality — Recommended Steps",
    intro: "Suggested plan steps to address quality issues:",
    items: [
      "Schedule and conduct an evaluation meeting with the tutor (main step)",
      "Review recent quality scores and highlight specific gaps",
      "Agree on improvement areas and concrete targets",
      "Set a follow-up review date (recommend 2 weeks)",
      "Re-evaluate quality score after the follow-up window",
    ],
    footer: "Main step: an evaluation meeting must be conducted with the tutor.",
  },
  cs_complaints: {
    title: "CS Complaints — Decision Helper",
    items: [
      "From the 2nd repeated CS ticket in the same month → place tutor on an action plan",
      "Conduct an evaluation meeting with the tutor",
      "Document the root cause and agreed corrective steps",
      "Monitor CS tickets for the rest of the month",
      "If additional tickets occur in the same month → escalate the plan",
    ],
  },
  communication: {
    title: "Communication — Suggested Steps",
    items: [
      "Identify specific communication gaps (response time, tone, clarity)",
      "Hold a coaching conversation with the tutor",
      "Set clear communication expectations and SLAs",
      "Monitor channels for 2 weeks and provide feedback",
      "Re-evaluate at the end of the plan",
    ],
  },
  leaves_abuse: null,
};

export function CategoryDecisionHelper({ category }: { category: ActionPlanCategory }) {
  const [open, setOpen] = useState(true);
  const helper = HELPERS[category];
  if (!helper) return null;

  return (
    <div className="border rounded-md bg-amber-500/5 border-amber-500/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-3 text-left"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
          <Lightbulb className="w-4 h-4" />
          {helper.title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 text-sm">
          {helper.intro && <p className="text-muted-foreground">{helper.intro}</p>}
          <ul className="space-y-1">
            {helper.items.map((it, i) => (
              <li key={i} className="flex gap-2">
                <span className={cn("mt-1 w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0")} />
                <span>{it}</span>
              </li>
            ))}
          </ul>
          {helper.footer && (
            <p className="pt-2 text-xs font-medium text-amber-700 border-t border-amber-500/20">
              {helper.footer}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
