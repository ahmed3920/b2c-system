import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTaskFilters } from "@/hooks/useTaskFilters";
import { TaskFilters } from "@/components/task/TaskFilters";
import { TaskStatusBadge } from "@/components/task/TaskStatusBadge";
import { TaskPriorityBadge } from "@/components/task/TaskPriorityBadge";
import { TaskDueDateBadge } from "@/components/task/TaskDueDateBadge";
import { TaskDetailsModal } from "@/components/task/TaskDetailsModal";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ClipboardList, Eye } from "lucide-react";
import { motion } from "framer-motion";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskStatus = Database["public"]["Enums"]["task_status"];

interface TeamMember {
  user_id: string;
  mentor_id: string;
  mentor_name: string;
  full_name: string | null;
}

interface TeamTasksTabProps {
  teamMembers: TeamMember[];
  onRefresh: () => void;
}

const taskTypes = [
  "One-to-One",
  "Study Plan",
  "Parent Meeting",
  "Group Session",
  "Assessment",
  "Documentation",
  "Training",
  "Other",
];

export function TeamTasksTab({ teamMembers, onRefresh }: TeamTasksTabProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filterMember, setFilterMember] = useState("");

  const memberMap = new Map(
    teamMembers.map((m) => [m.user_id, m.full_name || m.mentor_name])
  );

  const fetchTeamTasks = async () => {
    setIsLoading(true);
    const memberIds = teamMembers.map((m) => m.user_id);
    if (memberIds.length === 0) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .in("user_id", memberIds)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setTasks(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (teamMembers.length > 0) {
      fetchTeamTasks();
    } else {
      setTasks([]);
      setIsLoading(false);
    }
  }, [teamMembers]);

  // Apply member filter before passing to useTaskFilters
  const memberFilteredTasks = filterMember
    ? tasks.filter((t) => t.user_id === filterMember)
    : tasks;

  const {
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    filterMonth,
    setFilterMonth,
    filterPriority,
    setFilterPriority,
    showFilters,
    setShowFilters,
    filteredTasks,
    clearFilters,
    hasActiveFilters,
  } = useTaskFilters({ tasks: memberFilteredTasks });

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      throw error;
    }

    toast({ title: "Status Updated", description: `Task status changed to ${newStatus}` });
    fetchTeamTasks();
    onRefresh();
  };

  const handleClearAll = () => {
    clearFilters();
    setFilterMember("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Member filter + task filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Filter by member:</span>
          <Button
            size="sm"
            variant={filterMember === "" ? "default" : "outline"}
            onClick={() => setFilterMember("")}
          >
            All ({tasks.length})
          </Button>
          {teamMembers.map((m) => {
            const count = tasks.filter((t) => t.user_id === m.user_id).length;
            return (
              <Button
                key={m.user_id}
                size="sm"
                variant={filterMember === m.user_id ? "default" : "outline"}
                onClick={() => setFilterMember(m.user_id)}
              >
                {m.full_name || m.mentor_name} ({count})
              </Button>
            );
          })}
        </div>

        <TaskFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          filterMonth={filterMonth}
          onFilterMonthChange={setFilterMonth}
          filterPriority={filterPriority}
          onFilterPriorityChange={setFilterPriority}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          onClearFilters={handleClearAll}
          taskTypes={taskTypes}
          hasActiveFilters={hasActiveFilters || !!filterMember}
        />
      </div>

      {/* Task Table */}
      {filteredTasks.length === 0 ? (
        <div className="bg-card rounded-xl p-8 text-center border border-border">
          <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-foreground mb-2">No Tasks Found</h3>
          <p className="text-muted-foreground text-sm">
            {hasActiveFilters || filterMember
              ? "No tasks match the current filters."
              : "No tasks have been assigned to team members yet."}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assigned To</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Priority</TableHead>
                <TableHead className="hidden lg:table-cell">Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {memberMap.get(task.user_id) || "Unknown"}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{task.task_type}</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-[200px]">
                    <span className="truncate block text-sm text-muted-foreground">
                      {task.description}
                    </span>
                  </TableCell>
                  <TableCell>
                    <TaskStatusBadge status={task.status} size="sm" showIcon />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <TaskPriorityBadge priority={task.priority || 2} size="sm" />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {task.date_to ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{task.date_to}</span>
                        <TaskDueDateBadge
                          dateTo={task.date_to}
                          status={task.status}
                          showLabel={false}
                          size="sm"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedTask(task);
                        setDetailsOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 py-3 border-t border-border text-sm text-muted-foreground">
            Showing {filteredTasks.length} of {tasks.length} tasks
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      <TaskDetailsModal
        task={selectedTask}
        isOpen={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedTask(null);
        }}
        onStatusChange={
          selectedTask
            ? (newStatus) => handleStatusChange(selectedTask.id, newStatus)
            : undefined
        }
        canEditAll={true}
      />
    </motion.div>
  );
}
