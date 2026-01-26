import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, AlertCircle, CheckCircle, Archive } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["task_status"];

interface TaskStatusBadgeProps {
  status: TaskStatus;
  size?: "sm" | "md";
  showIcon?: boolean;
}

const statusConfig: Record<TaskStatus, { label: string; className: string; icon: React.ReactNode }> = {
  todo: {
    label: "To-Do",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
    icon: <Clock className="w-3 h-3" />,
  },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  done: {
    label: "Done",
    className: "bg-green-100 text-green-700 border-green-200",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  archived: {
    label: "Archived",
    className: "bg-gray-100 text-gray-700 border-gray-200",
    icon: <Archive className="w-3 h-3" />,
  },
};

export const TaskStatusBadge = ({ status, size = "md", showIcon = false }: TaskStatusBadgeProps) => {
  const config = statusConfig[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        config.className,
        "inline-flex items-center gap-1",
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"
      )}
    >
      {showIcon && config.icon}
      {config.label}
    </Badge>
  );
};
