import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TaskPriorityBadgeProps {
  priority: number;
  size?: "sm" | "md";
}

const priorityConfig: Record<number, { label: string; className: string }> = {
  1: { label: "Low", className: "bg-gray-100 text-gray-700 border-gray-200" },
  2: { label: "Medium", className: "bg-blue-100 text-blue-700 border-blue-200" },
  3: { label: "High", className: "bg-orange-100 text-orange-700 border-orange-200" },
  4: { label: "Urgent", className: "bg-red-100 text-red-700 border-red-200" },
};

export const TaskPriorityBadge = ({ priority, size = "md" }: TaskPriorityBadgeProps) => {
  const config = priorityConfig[priority] || priorityConfig[2];

  return (
    <Badge
      variant="outline"
      className={cn(
        config.className,
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"
      )}
    >
      {config.label}
    </Badge>
  );
};
