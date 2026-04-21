import { Badge } from "@/components/ui/badge";
import type { AdherenceStatus } from "@/hooks/useWeekAdherence";

const LABEL: Record<AdherenceStatus, string> = {
  on_track: "On track",
  partial: "Partial",
  off_plan: "Off plan",
  no_data: "No data",
};

export function AdherenceStatusBadge({ status }: { status: AdherenceStatus }) {
  const cls =
    status === "on_track"
      ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30"
      : status === "partial"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
        : status === "off_plan"
          ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
          : "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cls}>
      {LABEL[status]}
    </Badge>
  );
}
