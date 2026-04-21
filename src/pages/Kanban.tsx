import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminView } from "@/hooks/useAdminView";
import { AdminViewSelector } from "@/components/admin/AdminViewSelector";
import { Loader2, MoreVertical, Eye, Archive, ExternalLink, UserCheck, Filter, User } from "lucide-react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { Database } from "@/integrations/supabase/types";
import { TaskDetailsModal } from "@/components/task/TaskDetailsModal";
import { TaskPriorityBadge } from "@/components/task/TaskPriorityBadge";
import { TaskDueDateBadge, getTaskDueStatus } from "@/components/task/TaskDueDateBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TaskStatus = Database["public"]["Enums"]["task_status"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];

const columns: { id: TaskStatus; title: string; className: string }[] = [
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

interface TaskCardProps {
  task: Task;
  onView: () => void;
  onArchive: () => void;
  assignerName?: string;
  ownerName?: string;
  showOwner?: boolean;
}

const TaskCard = ({ task, onView, onArchive, assignerName, ownerName, showOwner }: TaskCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const [showMenu, setShowMenu] = useState(false);

  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 };
  const isAssigned = !!task.assigned_by;
  const priority = task.priority || 2;
  const dueStatus = getTaskDueStatus(task.date_to, task.status);

  const cardBorderClass = cn(
    "bg-card p-4 rounded-lg shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-all relative group",
    dueStatus === "overdue" && "border-destructive/50 bg-destructive/5",
    dueStatus === "due-soon" && "border-orange-400/50 bg-orange-50/50",
    dueStatus !== "overdue" && dueStatus !== "due-soon" && "border-border"
  );

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={cardBorderClass}>
      {/* Owner badge for admin views */}
      {showOwner && ownerName && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
          <User className="w-3 h-3" />
          <span className="truncate font-medium">{ownerName}</span>
        </div>
      )}

      {/* Header: Type + Priority */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs px-2 py-0.5 bg-secondary rounded font-medium truncate max-w-[120px]">
          {task.task_type}
        </span>
        <div className="flex items-center gap-1">
          <TaskPriorityBadge priority={priority} size="sm" />
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-secondary rounded ml-1"
          >
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <p className="text-sm text-foreground line-clamp-2 mb-3">{task.description}</p>

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {task.date_from && (
          <p className="text-xs text-muted-foreground">
            📅 {task.date_from}{task.date_to && ` → ${task.date_to}`}
          </p>
        )}
        <TaskDueDateBadge dateTo={task.date_to} status={task.status} size="sm" showLabel={true} />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-1">
          {isAssigned && (
            <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium">
              <UserCheck className="w-3 h-3" />
              {assignerName ? `by ${assignerName.split(" ")[0]}` : "Assigned"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {task.related_link && (
            <a href={task.related_link} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onView(); }} className="text-xs text-muted-foreground hover:text-primary transition-colors">
            View
          </button>
        </div>
      </div>

      {showMenu && (
        <div className="absolute right-2 top-10 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onView(); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2">
            <Eye className="w-4 h-4" /> View Details
          </button>
          {task.status !== "archived" && (
            <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onArchive(); setShowMenu(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2 text-destructive">
              <Archive className="w-4 h-4" /> Archive
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const Column = ({ column, tasks, children }: { column: (typeof columns)[0]; tasks: Task[]; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const overdueCount = tasks.filter(t => getTaskDueStatus(t.date_to, t.status) === "overdue").length;
  const dueSoonCount = tasks.filter(t => getTaskDueStatus(t.date_to, t.status) === "due-soon").length;

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

const Kanban = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [assignerNames, setAssignerNames] = useState<Record<string, string>>({});
  const [filterMonth, setFilterMonth] = useState("all");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isTeamLeader } = useUserRole();
  const adminView = useAdminView();

  const canEditAll = isAdmin || isTeamLeader;

  // Determine which tasks to display
  const displayTasks = isAdmin && adminView.viewMode !== "my" ? adminView.tasks : tasks;

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      setTasks(data || []);

      const assignerIds = [...new Set((data || []).map((t) => t.assigned_by).filter(Boolean))];
      if (assignerIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, mentor_name").in("user_id", assignerIds as string[]);
        if (profiles) {
          const nameMap: Record<string, string> = {};
          profiles.forEach((p) => { nameMap[p.user_id] = p.mentor_name; });
          setAssignerNames(nameMap);
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, [navigate]);

  const filteredTasks = filterMonth && filterMonth !== "all"
    ? displayTasks.filter((task) => {
        const taskMonth = task.date_from?.substring(5, 7) || task.date_to?.substring(5, 7);
        return taskMonth === filterMonth;
      })
    : displayTasks;

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const task = displayTasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    if (isAdmin && adminView.viewMode !== "my") {
      // For admin views, just update and refetch
      const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
      if (error) {
        toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
      } else {
        adminView.refetchTasks();
      }
    } else {
      setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
      const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
      if (error) {
        setTasks(tasks);
        toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
      }
    }
  };

  const handleArchive = async (task: Task) => {
    await supabase.from("tasks").update({ status: "archived" as TaskStatus }).eq("id", task.id);
    if (isAdmin && adminView.viewMode !== "my") {
      adminView.refetchTasks();
    } else {
      setTasks(tasks.map((t) => (t.id === task.id ? { ...t, status: "archived" as TaskStatus } : t)));
    }
  };

  const handleStatusChange = async (status: TaskStatus) => {
    if (!selectedTask) return;
    const { error } = await supabase.from("tasks").update({ status }).eq("id", selectedTask.id);
    if (error) {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
      throw error;
    }
    if (isAdmin && adminView.viewMode !== "my") {
      adminView.refetchTasks();
    } else {
      setTasks(tasks.map((t) => (t.id === selectedTask.id ? { ...t, status } : t)));
    }
    setSelectedTask({ ...selectedTask, status });
    toast({ title: "Status Updated", description: `Task status changed to ${status}.` });
  };

  if (isLoading) {
    return (
      <AppLayout title="Kanban Board">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const overdueCount = filteredTasks.filter(t => getTaskDueStatus(t.date_to, t.status) === "overdue").length;
  const dueSoonCount = filteredTasks.filter(t => getTaskDueStatus(t.date_to, t.status) === "due-soon").length;
  const showOwner = isAdmin && adminView.viewMode !== "my";

  const stats = {
    total: filteredTasks.length,
    inProgress: filteredTasks.filter((t) => t.status === "in_progress").length,
    done: filteredTasks.filter((t) => t.status === "done").length,
    archived: filteredTasks.filter((t) => t.status === "archived").length,
  };

  return (
    <AppLayout title="Kanban Board">
      <div className="px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {/* Page action bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
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

        {/* Admin View Selector */}
        {isAdmin && (
          <AdminViewSelector
            viewMode={adminView.viewMode}
            onViewModeChange={adminView.setViewMode}
            selectedUserId={adminView.selectedUserId}
            onSelectedUserChange={adminView.setSelectedUserId}
            teamLeaders={adminView.teamLeaders}
            mentors={adminView.mentors}
            selectedProfile={adminView.selectedProfile}
          />
        )}

        {isAdmin && adminView.isLoadingTasks && adminView.viewMode !== "my" ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
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
                          onView={() => setSelectedTask(task)}
                          onArchive={() => handleArchive(task)}
                          assignerName={task.assigned_by ? assignerNames[task.assigned_by] : undefined}
                          ownerName={adminView.taskOwnerNames[task.user_id]}
                          showOwner={showOwner}
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
        )}

        <TaskDetailsModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
          canEditAll={canEditAll}
          assignerName={selectedTask?.assigned_by ? assignerNames[selectedTask.assigned_by] : undefined}
        />
      </div>
    </AppLayout>
  );
};

export default Kanban;
