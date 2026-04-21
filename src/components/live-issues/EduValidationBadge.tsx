import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EduValidation = "deduct" | "no_deduction" | "pending" | null | undefined;

const STYLES: Record<string, string> = {
  deduct: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  no_deduction: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  pending: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  none: "bg-muted text-muted-foreground border-border",
};

const LABELS: Record<string, string> = {
  deduct: "Deduct",
  no_deduction: "No Deduction",
  pending: "Pending",
  none: "Not validated",
};

export function EduValidationBadge({ value, className }: { value: EduValidation; className?: string }) {
  const k = value ?? "none";
  return (
    <Badge variant="outline" className={cn(STYLES[k], "font-medium", className)}>
      {LABELS[k]}
    </Badge>
  );
}
