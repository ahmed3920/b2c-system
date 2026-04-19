import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_FIRST_STEP } from "./categoryFirstStep";
import type { ActionPlanCategory } from "@/hooks/useActionPlans";

interface Props {
  category: ActionPlanCategory;
  totalSteps: number;
  firstStepDone: boolean;
}

export function PlanProgressTracker({ category, totalSteps, firstStepDone }: Props) {
  const spec = CATEGORY_FIRST_STEP[category];
  if (!spec) return null;

  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        firstStepDone
          ? "border-green-500/30 bg-green-500/5"
          : "border-orange-500/40 bg-orange-500/5",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {firstStepDone ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-orange-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold">
              {firstStepDone ? "Step 1 complete" : "Awaiting Step 1"}
            </p>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                firstStepDone
                  ? "bg-green-500/15 text-green-700"
                  : "bg-orange-500/15 text-orange-700",
              )}
            >
              {firstStepDone
                ? `${totalSteps} update${totalSteps === 1 ? "" : "s"} posted`
                : "Tutor still on step 1"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{spec.description}</p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            {firstStepDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-orange-600" />
            )}
            <span className={firstStepDone ? "line-through text-muted-foreground" : "font-medium"}>
              Required first action: {spec.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
