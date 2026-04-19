import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_FIRST_STEP, isFirstStepDone } from "./categoryFirstStep";
import type { ActionPlanCategory } from "@/hooks/useActionPlans";

interface Props {
  category: ActionPlanCategory;
  notes: string[];
  totalSteps: number;
  className?: string;
}

/**
 * Compact badge showing whether the required first step is done.
 *  - "Step 1 pending" (orange)  → no updates posted
 *  - "In progress"   (blue)    → updates posted but first-step marker missing
 *  - "Step 1 done"   (green)   → first-step marker found
 */
export function FirstStepBadge({ category, notes, totalSteps, className }: Props) {
  const spec = CATEGORY_FIRST_STEP[category];
  if (!spec) return null;

  const done = isFirstStepDone(category, notes);
  let variant: "pending" | "in_progress" | "done";
  let label: string;
  let Icon = Circle;

  if (done) {
    variant = "done";
    label = "Step 1 done";
    Icon = CheckCircle2;
  } else if (totalSteps > 0) {
    variant = "in_progress";
    label = "In progress";
    Icon = Clock;
  } else {
    variant = "pending";
    label = "Step 1 pending";
    Icon = Circle;
  }

  const styles: Record<typeof variant, string> = {
    pending: "bg-orange-500/15 text-orange-700 border-orange-500/30",
    in_progress: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    done: "bg-green-500/15 text-green-700 border-green-500/30",
  };

  return (
    <span
      title={spec.description}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap",
        styles[variant],
        className,
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
