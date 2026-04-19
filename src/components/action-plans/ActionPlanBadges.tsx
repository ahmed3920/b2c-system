import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, STATUS_LABELS, type ActionPlanCategory, type ActionPlanStatus } from "@/hooks/useActionPlans";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ActionPlanStatus, string> = {
  active: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  on_hold: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  resolved: "bg-green-500/15 text-green-700 border-green-500/30",
  escalated: "bg-destructive/15 text-destructive border-destructive/30",
};

const CATEGORY_STYLES: Record<ActionPlanCategory, string> = {
  quality: "bg-primary/10 text-primary border-primary/20",
  emergency_abuse: "bg-red-500/15 text-red-700 border-red-500/30",
  no_show_abuse: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  communication: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  cs_complaints: "bg-pink-500/15 text-pink-700 border-pink-500/30",
  leaves_abuse: "bg-orange-500/15 text-orange-700 border-orange-500/30",
};

export function StatusBadge({ status }: { status: ActionPlanStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: ActionPlanCategory }) {
  return (
    <Badge variant="outline" className={cn("font-medium", CATEGORY_STYLES[category])}>
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}
