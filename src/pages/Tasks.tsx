import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTaskCategories } from "@/hooks/useTaskCategories";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminView } from "@/hooks/useAdminView";
import { useTeamLeaderView } from "@/hooks/useTeamLeaderView";
import { useTaskFilters } from "@/hooks/useTaskFilters";
import { AdminViewSelector } from "@/components/admin/AdminViewSelector";
import { TeamLeaderViewSelector } from "@/components/team/TeamLeaderViewSelector";
import {
  Plus,
  Edit,
  Eye,
  Archive,
  Loader2,
  Link as LinkIcon,
  AlertTriangle,
  User,
  Send,
  Download,
} from "lucide-react";
import { AdminTaskAssignDialog } from "@/components/admin/AdminTaskAssignDialog";
import { TaskTimeRange, calculateDurationMinutes, formatDuration } from "@/components/task/TaskTimeRange";
import { CoverSessionSlots } from "@/components/task/CoverSessionSlots";
import { motion } from "framer-motion";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { TaskDetailsModal } from "@/components/task/TaskDetailsModal";
import { TaskPriorityBadge } from "@/components/task/TaskPriorityBadge";
import { TaskStatusBadge } from "@/components/task/TaskStatusBadge";
import { TaskDueDateBadge, getTaskDueStatus } from "@/components/task/TaskDueDateBadge";
import { TaskFilters } from "@/components/task/TaskFilters";
import { TaskBreakdownStats, type BreakdownGroupBy } from "@/components/task/TaskBreakdownStats";
import { cn } from "@/lib/utils";
import { exportTasksToExcel } from "@/utils/exportTasksToExcel";

type TaskStatus = Database["public"]["Enums"]["task_status"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];

const fallbackTaskTypes = ["Other"];

const statusOptions: TaskStatus[] = ["todo", "in_progress", "done", "archived"];

const statusLabels: Record<TaskStatus, string> = {
  todo: "To-Do",
  in_progress: "In Progress",
  done: "Done",
  archived: "Archived",
};

const priorityOptions = [
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
  { value: 4, label: "Urgent" },
];

interface Profile {
  mentor_id: string;
  mentor_name: string;
  team_leader: string;
}

const Tasks = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [assignerNames, setAssignerNames] = useState<Record<string, string>>({});

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [formType, setFormType] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formDateFrom, setFormDateFrom] = useState("");
  const [formDateTo, setFormDateTo] = useState("");
  const [formStatus, setFormStatus] = useState<TaskStatus>("todo");
  const [formPriority, setFormPriority] = useState(2);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");
  const [coverSessionSlots, setCoverSessionSlots] = useState<string[]>([]);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isTeamLeader, role } = useUserRole();
  const adminView = useAdminView();
  const tlView = useTeamLeaderView();

  const canEditAll = isAdmin || isTeamLeader;
  const isTLMentorView = isTeamLeader && !isAdmin && tlView.viewMode === "mentor";

  // Determine which category role to use for filters
  const categoryRole = isTLMentorView ? "mentor" : (role || "mentor");
  const { categories: dbCategories } = useTaskCategories(categoryRole);
  const activeTaskTypes = dbCategories.length > 0 ? dbCategories : fallbackTaskTypes;

  // Determine which tasks to display
  const baseDisplayTasks = isAdmin && adminView.viewMode !== "my"
    ? adminView.tasks
    : isTLMentorView
      ? tlView.tasks
      : tasks;

  // Shared month filter (canonical format: "YYYY-MM" or "all").
  // Used by both the breakdown card and TaskFilters so they stay in sync.
  const [sharedMonth, setSharedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Breakdown scope (Team Leader vs Mentor) lifted from TaskBreakdownStats so
  // the table below reflects the same role + month filter.
  const [breakdownScope, setBreakdownScope] = useState<{
    groupBy: BreakdownGroupBy;
    monthFilter: string;
    userIds: string[];
  }>({ groupBy: "team_leader", monthFilter: "", userIds: [] });

  // Only apply the breakdown scope filter where the breakdown is visible:
  // admin (any view) and team leader in "my" view (when breakdown is shown).
  const showBreakdown = isAdmin || isTeamLeader;
  // Don't apply breakdown scope when the user has an active explicit view selector
  // (admin non-"my" view, or TL "mentor" view) — those views have their own user filtering.
  const skipBreakdownScope =
    (isAdmin && adminView.viewMode !== "my") || isTLMentorView;
  const displayTasks = showBreakdown && !skipBreakdownScope && breakdownScope.userIds.length > 0
    ? baseDisplayTasks.filter((t) => {
        if (!breakdownScope.userIds.includes(t.user_id)) return false;
        if (breakdownScope.monthFilter && breakdownScope.monthFilter !== "all") {
          return t.created_at?.startsWith(breakdownScope.monthFilter);
        }
        return true;
      })
    : baseDisplayTasks;

  // Use the task filters hook
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
  } = useTaskFilters({ tasks: displayTasks, ownerNames: adminView.taskOwnerNames });

  // Sync TaskFilters' "MM" filterMonth with sharedMonth ("YYYY-MM" / "all").
  useEffect(() => {
    const mm = sharedMonth && sharedMonth !== "all" ? sharedMonth.slice(5, 7) : "";
    if (mm !== filterMonth) setFilterMonth(mm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedMonth]);

  // When user changes the TaskFilters month, push it back to sharedMonth.
  const handleFilterMonthChange = (mm: string) => {
    setFilterMonth(mm);
    if (!mm) {
      setSharedMonth("all");
    } else {
      const year = sharedMonth && sharedMonth !== "all"
        ? sharedMonth.slice(0, 4)
        : String(new Date().getFullYear());
      setSharedMonth(`${year}-${mm}`);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("mentor_id, mentor_name, team_leader")
          .eq("user_id", user.id)
          .maybeSingle();

        setProfile(profileData);

        const { data: tasksData, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setTasks(tasksData || []);

        const assignerIds = [...new Set((tasksData || []).map((t) => t.assigned_by).filter(Boolean))];
        if (assignerIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, mentor_name")
            .in("user_id", assignerIds as string[]);
          if (profiles) {
            const nameMap: Record<string, string> = {};
            profiles.forEach((p) => {
              nameMap[p.user_id] = p.mentor_name;
            });
            setAssignerNames(nameMap);
          }
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load data.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user, toast]);

  const resetForm = () => {
    setFormType(activeTaskTypes[0] || "");
    setFormDescription("");
    setFormLink("");
    setFormDateFrom("");
    setFormDateTo("");
    setFormStatus("todo");
    setFormPriority(2);
    setFormErrors({});
    setFormStartTime("");
    setFormEndTime("");
    setCoverSessionSlots([]);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formDescription.trim()) errors.description = "Description is required";
    if (!formDateFrom) errors.dateFrom = "Start date is required";
    if (!formDateTo) errors.dateTo = "Due date is required";
    if (formDateFrom && formDateTo && formDateFrom > formDateTo) errors.dateTo = "Due date must be after start date";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddTask = async () => {
    if (!user || !validateForm()) return;
    setIsSaving(true);
    try {
      const isCoverSession = formType === "Cover Session";
      const durationMins = isCoverSession && coverSessionSlots.length > 0
        ? coverSessionSlots.length * 60
        : calculateDurationMinutes(formStartTime, formEndTime);
      const description = isCoverSession && coverSessionSlots.length > 0
        ? `${formDescription.trim()}\n\nCover Sessions: ${coverSessionSlots.map(s => {
            const h = parseInt(s.split(":")[0]);
            const m = s.split(":")[1];
            const ampm = h >= 12 ? "PM" : "AM";
            const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
            return `${h12}:${m} ${ampm}`;
          }).join(", ")}`
        : formDescription.trim();

      const { data, error } = await supabase.from("tasks").insert({
        user_id: user.id,
        task_type: formType,
        description,
        related_link: formLink.trim() || null,
        date_from: formDateFrom,
        date_to: formDateTo,
        status: formStatus,
        priority: formPriority,
        start_time: isCoverSession ? null : (formStartTime || null),
        end_time: isCoverSession ? null : (formEndTime || null),
        duration_minutes: durationMins || null,
      }).select().single();

      if (error) throw error;
      setTasks([data, ...tasks]);
      setIsAddModalOpen(false);
      resetForm();
      toast({ title: "Task Created", description: "Your task has been created successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTask = async () => {
    if (!selectedTask || !validateForm()) return;
    setIsSaving(true);
    try {
      const durationMins = calculateDurationMinutes(formStartTime, formEndTime);
      const { data, error } = await supabase
        .from("tasks")
        .update({
          task_type: formType,
          description: formDescription.trim(),
          related_link: formLink.trim() || null,
          date_from: formDateFrom,
          date_to: formDateTo,
          status: formStatus,
          priority: formPriority,
          start_time: formStartTime || null,
          end_time: formEndTime || null,
          duration_minutes: durationMins || null,
        })
        .eq("id", selectedTask.id)
        .select()
        .single();

      if (error) throw error;
      setTasks(tasks.map((t) => (t.id === selectedTask.id ? data : t)));
      if (isAdmin && adminView.viewMode !== "my") adminView.refetchTasks();
      setIsEditModalOpen(false);
      setSelectedTask(null);
      resetForm();
      toast({ title: "Task Updated", description: "Your task has been updated successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveTask = async (task: Task) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "archived" as TaskStatus })
        .eq("id", task.id);
      if (error) throw error;
      setTasks(tasks.map((t) => (t.id === task.id ? { ...t, status: "archived" as TaskStatus } : t)));
      if (isAdmin && adminView.viewMode !== "my") adminView.refetchTasks();
      toast({ title: "Task Archived", description: "The task has been archived." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to archive task.", variant: "destructive" });
    }
  };

  const handleStatusChange = async (status: TaskStatus) => {
    if (!selectedTask) return;
    setTasks(tasks.map((t) => (t.id === selectedTask.id ? { ...t, status } : t)));
    const { error } = await supabase.from("tasks").update({ status }).eq("id", selectedTask.id);
    if (error) {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
      throw error;
    }
    setSelectedTask({ ...selectedTask, status });
    if (isAdmin && adminView.viewMode !== "my") adminView.refetchTasks();
    toast({ title: "Status Updated", description: `Task status changed to ${statusLabels[status]}.` });
  };

  const openEditModal = (task: Task) => {
    const isAssignedTask = !!task.assigned_by;
    if (isAssignedTask && !canEditAll) {
      toast({ title: "Cannot Edit", description: "This task was assigned to you.", variant: "destructive" });
      return;
    }
    setSelectedTask(task);
    setFormType(task.task_type);
    setFormDescription(task.description);
    setFormLink(task.related_link || "");
    setFormDateFrom(task.date_from || "");
    setFormDateTo(task.date_to || "");
    setFormStatus(task.status);
    setFormPriority(task.priority || 2);
    setFormErrors({});
    setFormStartTime((task as any).start_time || "");
    setFormEndTime((task as any).end_time || "");
    setCoverSessionSlots([]);
    setIsEditModalOpen(true);
  };

  const openViewModal = (task: Task) => {
    setSelectedTask(task);
    setIsViewModalOpen(true);
  };

  const overdueCount = displayTasks.filter(t => getTaskDueStatus(t.date_to, t.status) === "overdue").length;
  const dueSoonCount = displayTasks.filter(t => getTaskDueStatus(t.date_to, t.status) === "due-soon").length;

  // Combine assigner names from both sources
  const allAssignerNames = { ...assignerNames, ...adminView.taskOwnerNames };

  if (isLoading) {
    return (
      <AppLayout title="Task Management">
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Task Management">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Page header with stats and actions */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-destructive/10 text-destructive text-sm rounded-full font-medium">
              <AlertTriangle className="w-3 h-3" />
              {overdueCount} Overdue
            </span>
          )}
          {dueSoonCount > 0 && (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-sm rounded-full font-medium">
              {dueSoonCount} Due Soon
            </span>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportOpen(true)}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          )}
          {isAdmin && adminView.viewMode !== "my" && (
            <Button onClick={() => setIsAssignDialogOpen(true)} className="bg-gradient-primary hover:opacity-90 gap-2">
              <Send className="w-4 h-4" />
              Assign Task
            </Button>
          )}
          {(adminView.viewMode === "my" || !isAdmin) && !isTLMentorView && (
            <Button onClick={() => setIsAddModalOpen(true)} className="bg-gradient-primary hover:opacity-90 gap-2">
              <Plus className="w-4 h-4" />
              Add Task
            </Button>
          )}
        </div>

        {/* Admin View Selector */}
        {isAdmin && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
            <AdminViewSelector
              viewMode={adminView.viewMode}
              onViewModeChange={adminView.setViewMode}
              selectedUserId={adminView.selectedUserId}
              onSelectedUserChange={adminView.setSelectedUserId}
              teamLeaders={adminView.teamLeaders}
              mentors={adminView.mentors}
              selectedProfile={adminView.selectedProfile}
              tlSubView={adminView.tlSubView}
              onTlSubViewChange={adminView.setTlSubView}
            />
          </motion.div>
        )}

        {/* Team Leader View Selector */}
        {isTeamLeader && !isAdmin && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
            <TeamLeaderViewSelector
              viewMode={tlView.viewMode}
              onViewModeChange={tlView.setViewMode}
              selectedUserId={tlView.selectedUserId}
              onSelectedUserChange={tlView.setSelectedUserId}
              mentors={tlView.teamMentors}
              selectedProfile={tlView.selectedProfile}
            />
          </motion.div>
        )}

        {/* Loading indicator for TL view changes */}
        {isTLMentorView && tlView.isLoadingTasks && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* Loading indicator for admin view changes */}
        {isAdmin && adminView.isLoadingTasks && adminView.viewMode !== "my" && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* Aggregated breakdown by Team Leader / Mentor (admins & TLs only) */}
        <TaskBreakdownStats
          monthFilter={sharedMonth}
          onMonthFilterChange={setSharedMonth}
          onScopeChange={setBreakdownScope}
        />

        {/* Filters */}
        {!(isAdmin && adminView.isLoadingTasks && adminView.viewMode !== "my") && (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <TaskFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filterType={filterType}
                onFilterTypeChange={setFilterType}
                filterStatus={filterStatus}
                onFilterStatusChange={setFilterStatus}
                filterMonth={filterMonth}
                onFilterMonthChange={handleFilterMonthChange}
                filterPriority={filterPriority}
                onFilterPriorityChange={setFilterPriority}
                showFilters={showFilters}
                onToggleFilters={() => setShowFilters(!showFilters)}
                onClearFilters={clearFilters}
                taskTypes={activeTaskTypes}
                hasActiveFilters={hasActiveFilters}
              />
            </motion.div>

            {/* Tasks Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card rounded-xl shadow-lg overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary">
                    <tr>
                      {(isAdmin && adminView.viewMode !== "my" || isTLMentorView) && (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Owner
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Task Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Dates
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan={(isAdmin && adminView.viewMode !== "my") || isTLMentorView ? 9 : 8} className="px-6 py-12 text-center text-muted-foreground">
                          {displayTasks.length === 0
                            ? (adminView.viewMode !== "my" && isAdmin) || isTLMentorView
                              ? "Select a user to view their tasks, or no tasks found."
                              : "No tasks yet. Click 'Add Task' to create your first task."
                            : "No tasks match your filters."}
                        </td>
                      </tr>
                    ) : (
                      filteredTasks.map((task) => {
                        const isAssigned = !!task.assigned_by;
                        const assignerName = task.assigned_by ? allAssignerNames[task.assigned_by] : null;
                        const dueStatus = getTaskDueStatus(task.date_to, task.status);
                        const ownerName = adminView.taskOwnerNames[task.user_id] || tlView.taskOwnerNames[task.user_id];

                        return (
                          <tr
                            key={task.id}
                            className={cn(
                              "hover:bg-secondary/50 transition-colors",
                              dueStatus === "overdue" && "bg-destructive/5",
                              dueStatus === "due-soon" && "bg-orange-50/50"
                            )}
                          >
                            {(isAdmin && adminView.viewMode !== "my" || isTLMentorView) && (
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                                    <User className="w-3 h-3 text-primary" />
                                  </div>
                                  <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                                    {ownerName || "Unknown"}
                                  </span>
                                </div>
                              </td>
                            )}
                            <td className="px-4 py-4">
                              <span className="text-xs px-2 py-1 bg-secondary rounded font-medium">
                                {task.task_type}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <p className="text-sm text-foreground line-clamp-2 max-w-xs">
                                {task.description}
                              </p>
                              {task.related_link && (
                                <a
                                  href={task.related_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                                >
                                  <LinkIcon className="w-3 h-3" />
                                  View Link
                                </a>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <TaskPriorityBadge priority={task.priority || 2} />
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-1">
                                <TaskStatusBadge status={task.status} showIcon />
                                <TaskDueDateBadge dateTo={task.date_to} status={task.status} size="sm" />
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-muted-foreground">
                                {task.date_from && task.date_to
                                  ? `${task.date_from} → ${task.date_to}`
                                  : task.date_from || task.date_to || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {(task as any).duration_minutes ? (
                                <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-full">
                                  {formatDuration((task as any).duration_minutes)}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openViewModal(task)} className="h-8 w-8 p-0">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {(canEditAll || !isAssigned) && (
                                  <Button variant="ghost" size="sm" onClick={() => openEditModal(task)} className="h-8 w-8 p-0">
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                                {task.status !== "archived" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleArchiveTask(task)}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  >
                                    <Archive className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t border-border bg-secondary/50">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredTasks.length} of {displayTasks.length} tasks
                </p>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Add Task Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {profile && (
              <div className="p-3 bg-secondary rounded-lg text-sm">
                <p><strong>Mentor:</strong> {profile.mentor_name} ({profile.mentor_id})</p>
                <p><strong>Team Leader:</strong> {profile.team_leader}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeTaskTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Enter task description..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className={formErrors.description ? "border-destructive" : ""}
                rows={3}
              />
              {formErrors.description && <p className="text-xs text-destructive">{formErrors.description}</p>}
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={String(formPriority)} onValueChange={(v) => setFormPriority(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Related Link</Label>
              <Input type="url" placeholder="https://..." value={formLink} onChange={(e) => setFormLink(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date From *</Label>
                <Input type="date" value={formDateFrom} onChange={(e) => setFormDateFrom(e.target.value)} className={formErrors.dateFrom ? "border-destructive" : ""} />
                {formErrors.dateFrom && <p className="text-xs text-destructive">{formErrors.dateFrom}</p>}
              </div>
              <div className="space-y-2">
                <Label>Date To *</Label>
                <Input type="date" value={formDateTo} onChange={(e) => setFormDateTo(e.target.value)} className={formErrors.dateTo ? "border-destructive" : ""} />
                {formErrors.dateTo && <p className="text-xs text-destructive">{formErrors.dateTo}</p>}
              </div>
            </div>

            {formType !== "Cover Session" && (
              <TaskTimeRange startTime={formStartTime} endTime={formEndTime} onStartTimeChange={setFormStartTime} onEndTimeChange={setFormEndTime} />
            )}
            {formType === "Cover Session" && (
              <CoverSessionSlots selectedSlots={coverSessionSlots} onSlotsChange={setCoverSessionSlots} />
            )}

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.filter(s => s !== "archived").map((status) => (
                    <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTask} disabled={isSaving} className="bg-gradient-primary">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeTaskTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Enter task description..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className={formErrors.description ? "border-destructive" : ""}
                rows={3}
              />
              {formErrors.description && <p className="text-xs text-destructive">{formErrors.description}</p>}
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={String(formPriority)} onValueChange={(v) => setFormPriority(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Related Link</Label>
              <Input type="url" placeholder="https://..." value={formLink} onChange={(e) => setFormLink(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date From *</Label>
                <Input type="date" value={formDateFrom} onChange={(e) => setFormDateFrom(e.target.value)} className={formErrors.dateFrom ? "border-destructive" : ""} />
                {formErrors.dateFrom && <p className="text-xs text-destructive">{formErrors.dateFrom}</p>}
              </div>
              <div className="space-y-2">
                <Label>Date To *</Label>
                <Input type="date" value={formDateTo} onChange={(e) => setFormDateTo(e.target.value)} className={formErrors.dateTo ? "border-destructive" : ""} />
                {formErrors.dateTo && <p className="text-xs text-destructive">{formErrors.dateTo}</p>}
              </div>
            </div>

            <TaskTimeRange startTime={formStartTime} endTime={formEndTime} onStartTimeChange={setFormStartTime} onEndTimeChange={setFormEndTime} />

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleEditTask} disabled={isSaving} className="bg-gradient-primary">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Task Modal */}
      <TaskDetailsModal
        task={selectedTask}
        isOpen={isViewModalOpen}
        onClose={() => { setIsViewModalOpen(false); setSelectedTask(null); }}
        onStatusChange={handleStatusChange}
        canEditAll={canEditAll}
        assignerName={selectedTask?.assigned_by ? allAssignerNames[selectedTask.assigned_by] : undefined}
      />

      {/* Admin Assign Task Dialog */}
      {isAdmin && (
        <AdminTaskAssignDialog
          open={isAssignDialogOpen}
          onOpenChange={setIsAssignDialogOpen}
          onTaskAssigned={() => {
            adminView.refetchTasks();
            // Also refresh personal tasks
            if (user) {
              supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => {
                if (data) setTasks(data);
              });
            }
          }}
        />
      )}
    </AppLayout>
  );
};

export default Tasks;
