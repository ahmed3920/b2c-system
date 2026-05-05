import { useMemo, useState } from "react";
import { CmsLayout } from "@/components/cms/CmsLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  MoreVertical,
  Eye,
  Archive,
  Filter,
  User,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  TaskDueDateBadge,
  getTaskDueStatus,
} from "@/components/task/TaskDueDateBadge";
import { useCmsTasks, type CmsTask, type CmsTaskStatus } from "@/hooks/useCmsTasks";
import { useCmsRole } from "@/hooks/useCmsRole";
import { useCmsUsers } from "@/hooks/useCmsUsers";
import { Badge } from "@/components/ui/badge";
import { CmsTaskDetailDialog } from "@/components/cms/CmsTaskDetailDialog";

const columns: { id: CmsTaskStatus; title: string; className: string }[] = [
  { id: "todo", title: "To-Do", className: "kanban-todo" },
  { id: "in_progress", title: "In Progress", className: "kanban-in-progress" },
  { id: "done", title: "Done", className: "kanban-done" },
  { id: "archived", title: "Archived", className: "kanban-archived" },
];

const monthOptions = [
  { value: "all", label: "All Months" },
  { value: "01", label: "January" }, { value: "02", label: "February" },
  { value: "03", label: "March" }, { value: "04", label: "April" },
  { value: "05", label: "May" }, { value: "06", label: "June" },
  { value: "07", label: "July" }, { value: "08", label: "August" },
  { value: "09", label: "September" }, { value: "10", label: "October" },
  { value: "11", label: "November" }, { value: "12", label: "December" },
];

const priorityClasses: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 border-gray-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
};

function PriorityBadge({ p }: { p: string }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", priorityClasses[p] ?? priorityClasses.medium)}>
      {p}
    </Badge>
  );
}

interface TaskCardProps {
  task: CmsTask;
  ownerName?: string;
  showOwner?: boolean;
  canManage: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onOpen: () => void;
}

const TaskCard = ({ task, ownerName, showOwner, canManage, onArchive, onDelete, onOpen }: TaskCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const [showMenu, setShowMenu] = useState(false);

  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 };
  const dueStatus = getTaskDueStatus(task.date_to, task.status);

  const cardBorderClass = cn(
    "bg-card p-4 rounded-lg shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-all relative group",
    dueStatus === "overdue" && "border-destructive/50 bg-destructive/5",
    dueStatus === "due-soon" && "border-orange-400/50 bg-orange-50/50",
    dueStatus !== "overdue" && dueStatus !== "due-soon" && "border-border"
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cardBorderClass}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
    >
      {showOwner && ownerName && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
          <User className="w-3 h-3" />
          <span className="truncate font-medium">{ownerName}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs px-2 py-0.5 bg-secondary rounded font-medium truncate max-w-[160px]">
          {task.title}
        </span>
        <div className="flex items-center gap-1">
          <PriorityBadge p={task.priority} />
          {canManage && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-secondary rounded ml-1"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {task.description && (
        <p className="text-sm text-foreground line-clamp-2 mb-3">{task.description}</p>
      )}

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {task.date_from && (
          <p className="text-xs text-muted-foreground">
            📅 {task.date_from}{task.date_to && ` → ${task.date_to}`}
          </p>
        )}
        <TaskDueDateBadge dateTo={task.date_to} status={task.status} size="sm" showLabel />
      </div>

      {showMenu && (
        <div className="absolute right-2 top-10 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
          {task.status !== "archived" && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onArchive(); setShowMenu(false); }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2"
            >
              <Archive className="w-4 h-4" /> Archive
            </button>
          )}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2 text-destructive"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

const Column = ({
  column,
  tasks,
  children,
}: {
  column: (typeof columns)[0];
  tasks: CmsTask[];
  children: React.ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const overdueCount = tasks.filter((t) => getTaskDueStatus(t.date_to, t.status) === "overdue").length;
  const dueSoonCount = tasks.filter((t) => getTaskDueStatus(t.date_to, t.status) === "due-soon").length;

  return (
    <div className={`flex-shrink-0 w-80 bg-card rounded-xl ${column.className} ${isOver ? "ring-2 ring-primary" : ""}`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-foreground">{column.title}</h3>
          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full font-medium">{tasks.length}</span>
        </div>
        {(overdueCount > 0 || dueSoonCount > 0) && column.id !== "done" && column.id !== "archived" && (
          <div className="flex gap-2 text-xs">
            {overdueCount > 0 && <span className="text-destructive font-medium">{overdueCount} overdue</span>}
            {dueSoonCount > 0 && <span className="text-orange-500 font-medium">{dueSoonCount} due soon</span>}
          </div>
        )}
      </div>
      <div ref={setNodeRef} className="p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

export default function CmsKanban() {
  const { tasks, loading, update, remove } = useCmsTasks();
  const { isCmsAdmin, isCmsSupervisor } = useCmsRole();
  const { users } = useCmsUsers();
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState("all");

  const canManage = isCmsAdmin || isCmsSupervisor;
  const showOwner = canManage;

  const userMap = useMemo(
    () => new Map(users.map((u) => [u.user_id, u.full_name])),
    [users],
  );

  const filteredTasks = useMemo(() => {
    if (!filterMonth || filterMonth === "all") return tasks;
    return tasks.filter((t) => {
      const m = t.date_from?.substring(5, 7) || t.date_to?.substring(5, 7);
      return m === filterMonth;
    });
  }, [tasks, filterMonth]);

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const taskId = active.id as string;
    const newStatus = over.id as CmsTaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const res = await update(taskId, { status: newStatus });
    if (!res.ok) {
      toast({ title: "Error", description: res.error || "Failed to update task.", variant: "destructive" });
    }
  };

  const handleArchive = async (task: CmsTask) => {
    const res = await update(task.id, { status: "archived" });
    if (!res.ok) toast({ title: "Error", description: res.error, variant: "destructive" });
  };

  const handleDelete = async (task: CmsTask) => {
    const res = await remove(task.id);
    if (!res.ok) toast({ title: "Error", description: res.error, variant: "destructive" });
    else toast({ title: "Task deleted" });
  };

  if (loading) {
    return (
      <CmsLayout title="Kanban Board">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </CmsLayout>
    );
  }

  const overdueCount = filteredTasks.filter((t) => getTaskDueStatus(t.date_to, t.status) === "overdue").length;
  const dueSoonCount = filteredTasks.filter((t) => getTaskDueStatus(t.date_to, t.status) === "due-soon").length;
  const stats = {
    total: filteredTasks.length,
    done: filteredTasks.filter((t) => t.status === "done").length,
  };

  return (
    <CmsLayout title="Kanban Board">
      <div className="px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 text-sm flex-wrap">
            <span className="px-3 py-1 bg-secondary rounded-full">Total: {stats.total}</span>
            {overdueCount > 0 && (
              <span className="px-3 py-1 bg-destructive/10 text-destructive rounded-full font-medium">Overdue: {overdueCount}</span>
            )}
            {dueSoonCount > 0 && (
              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full font-medium">Due Soon: {dueSoonCount}</span>
            )}
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">Done: {stats.done}</span>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2 px-2">
          <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 min-w-max">
              {columns.map((column) => (
                <Column key={column.id} column={column} tasks={filteredTasks.filter((t) => t.status === column.id)}>
                  {filteredTasks
                    .filter((t) => t.status === column.id)
                    .map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        ownerName={task.assignee_id ? userMap.get(task.assignee_id) : undefined}
                        showOwner={showOwner}
                        canManage={canManage}
                        onArchive={() => handleArchive(task)}
                        onDelete={() => handleDelete(task)}
                      />
                    ))}
                </Column>
              ))}
            </div>
            <DragOverlay>
              {activeId ? (
                <div className="bg-card p-3 rounded-lg shadow-xl border-2 border-primary opacity-90">
                  Dragging...
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </CmsLayout>
  );
}
