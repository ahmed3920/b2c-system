import { differenceInDays, parseISO, isAfter, isBefore, startOfDay } from "date-fns";
import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskDueDateBadgeProps {
  dateFrom?: string | null;
  dateTo?: string | null;
  status: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export const getTaskDueStatus = (
  dateTo: string | null | undefined,
  status: string
): "overdue" | "due-soon" | "on-track" | "completed" | "no-date" => {
  if (status === "done" || status === "archived") return "completed";
  if (!dateTo) return "no-date";

  const today = startOfDay(new Date());
  const dueDate = startOfDay(parseISO(dateTo));
  const daysUntilDue = differenceInDays(dueDate, today);

  if (isBefore(dueDate, today)) return "overdue";
  if (daysUntilDue <= 2) return "due-soon";
  return "on-track";
};

export const TaskDueDateBadge = ({
  dateFrom,
  dateTo,
  status,
  showLabel = true,
  size = "md",
}: TaskDueDateBadgeProps) => {
  const dueStatus = getTaskDueStatus(dateTo, status);

  if (dueStatus === "no-date") return null;
  if (dueStatus === "completed") return null;

  const config = {
    overdue: {
      icon: AlertTriangle,
      label: "Overdue",
      className: "bg-destructive/10 text-destructive border-destructive/30",
      iconClassName: "text-destructive",
    },
    "due-soon": {
      icon: Clock,
      label: "Due Soon",
      className: "bg-warning/10 text-warning-foreground border-warning/30",
      iconClassName: "text-orange-500",
    },
    "on-track": {
      icon: CheckCircle2,
      label: "On Track",
      className: "bg-success/10 text-success border-success/30",
      iconClassName: "text-green-500",
    },
  };

  const { icon: Icon, label, className, iconClassName } = config[dueStatus];

  const sizeClasses = size === "sm" 
    ? "text-[10px] px-1.5 py-0.5 gap-1" 
    : "text-xs px-2 py-0.5 gap-1.5";

  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium border",
        sizeClasses,
        className
      )}
    >
      <Icon className={cn(iconSize, iconClassName)} />
      {showLabel && label}
    </span>
  );
};
