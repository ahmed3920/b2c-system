import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Calendar, User, UserCheck, AlertCircle, Clock, CheckCircle, Archive } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useState, useEffect } from "react";

type TaskStatus = Database["public"]["Enums"]["task_status"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];

interface TaskDetailsModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onStatusChange?: (status: TaskStatus) => Promise<void>;
  canEditAll: boolean;
  assignerName?: string;
}

const statusLabels: Record<TaskStatus, string> = {
  todo: "To-Do",
  in_progress: "In Progress",
  done: "Done",
  archived: "Archived",
};

const statusIcons: Record<TaskStatus, React.ReactNode> = {
  todo: <Clock className="w-4 h-4" />,
  in_progress: <AlertCircle className="w-4 h-4" />,
  done: <CheckCircle className="w-4 h-4" />,
  archived: <Archive className="w-4 h-4" />,
};

const statusColors: Record<TaskStatus, string> = {
  todo: "bg-yellow-100 text-yellow-700 border-yellow-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  done: "bg-green-100 text-green-700 border-green-200",
  archived: "bg-gray-100 text-gray-700 border-gray-200",
};

const priorityLabels: Record<number, { label: string; color: string }> = {
  1: { label: "Low", color: "bg-gray-100 text-gray-700" },
  2: { label: "Medium", color: "bg-blue-100 text-blue-700" },
  3: { label: "High", color: "bg-orange-100 text-orange-700" },
  4: { label: "Urgent", color: "bg-red-100 text-red-700" },
};

const statusOptions: TaskStatus[] = ["todo", "in_progress", "done", "archived"];

export const TaskDetailsModal = ({
  task,
  isOpen,
  onClose,
  onEdit,
  onStatusChange,
  canEditAll,
  assignerName,
}: TaskDetailsModalProps) => {
  const [localStatus, setLocalStatus] = useState<TaskStatus>("todo");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (task) {
      setLocalStatus(task.status);
    }
  }, [task]);

  if (!task) return null;

  const isAssignedTask = !!task.assigned_by;
  const priority = task.priority || 2;
  const priorityInfo = priorityLabels[priority] || priorityLabels[2];

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (onStatusChange && newStatus !== task.status) {
      setIsUpdating(true);
      setLocalStatus(newStatus);
      try {
        await onStatusChange(newStatus);
      } catch {
        setLocalStatus(task.status);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Task Details
            {isAssignedTask && (
              <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/30">
                Assigned Task
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Type and Status Row */}
          <div className="flex items-center justify-between gap-3">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {task.task_type}
            </Badge>
            <div className="flex items-center gap-2">
              {statusIcons[task.status]}
              <Badge className={`${statusColors[task.status]} border`}>
                {statusLabels[task.status]}
              </Badge>
            </div>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-3">
            <Label className="text-muted-foreground text-sm min-w-[80px]">Priority:</Label>
            <Badge className={priorityInfo.color}>{priorityInfo.label}</Badge>
          </div>

          <Separator />

          {/* Description */}
          <div>
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">Description</Label>
            <p className="text-foreground mt-2 leading-relaxed">{task.description}</p>
          </div>

          {/* Related Link */}
          {task.related_link && (
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Related Link</Label>
              <a
                href={task.related_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline mt-2"
              >
                <ExternalLink className="w-4 h-4" />
                {task.related_link}
              </a>
            </div>
          )}

          {/* Dates */}
          {(task.date_from || task.date_to) && (
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Date Range</Label>
                <p className="text-foreground mt-1">
                  {task.date_from && task.date_to
                    ? `${task.date_from} → ${task.date_to}`
                    : task.date_from || task.date_to}
                </p>
              </div>
            </div>
          )}

          <Separator />

          {/* Assignment Info */}
          <div className="grid grid-cols-2 gap-4">
            {isAssignedTask && (
              <div className="flex items-start gap-3">
                <UserCheck className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Assigned By</Label>
                  <p className="text-foreground mt-1 font-medium">{assignerName || "Admin/Team Leader"}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                  {isAssignedTask ? "Assigned To" : "Created By"}
                </Label>
                <p className="text-foreground mt-1">You</p>
              </div>
            </div>
          </div>

          {/* Quick Status Update for Assigned Tasks */}
          {isAssignedTask && !canEditAll && onStatusChange && (
            <>
              <Separator />
              <div className="bg-secondary/50 rounded-lg p-4">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-2 block">
                  Update Status
                </Label>
                <p className="text-xs text-muted-foreground mb-3">
                  This task was assigned to you. You can only update the status.
                </p>
                <Select
                  value={localStatus}
                  onValueChange={(v) => handleStatusChange(v as TaskStatus)}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        <div className="flex items-center gap-2">
                          {statusIcons[status]}
                          {statusLabels[status]}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border text-sm">
            <div>
              <Label className="text-muted-foreground text-xs">Created</Label>
              <p className="text-foreground mt-1">
                {new Date(task.created_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Last Updated</Label>
              <p className="text-foreground mt-1">
                {new Date(task.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {(canEditAll || !isAssignedTask) && onEdit && (
            <Button onClick={onEdit} className="bg-gradient-primary">
              Edit Task
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
