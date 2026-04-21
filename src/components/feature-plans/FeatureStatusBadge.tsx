import { Badge } from "@/components/ui/badge";
import { FeatureStatus, statusLabel } from "@/data/mockFeaturePlans";
import { cn } from "@/lib/utils";

const styles: Record<FeatureStatus, string> = {
  planned: "bg-muted text-foreground hover:bg-muted",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/15 border-blue-500/30",
  completed: "bg-green-500/15 text-green-700 dark:text-green-300 hover:bg-green-500/15 border-green-500/30",
  blocked: "bg-destructive/15 text-destructive hover:bg-destructive/15 border-destructive/30",
};

export function FeatureStatusBadge({ status }: { status: FeatureStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", styles[status])}>
      {statusLabel(status)}
    </Badge>
  );
}
