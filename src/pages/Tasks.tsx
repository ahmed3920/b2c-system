import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
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
import {
  Plus,
  Search,
  Filter,
  X,
  Edit,
  Eye,
  Archive,
  ArrowLeft,
  Loader2,
  Link as LinkIcon,
  UserCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { TaskDetailsModal } from "@/components/task/TaskDetailsModal";
import { TaskPriorityBadge } from "@/components/task/TaskPriorityBadge";
import { TaskStatusBadge } from "@/components/task/TaskStatusBadge";

type TaskStatus = Database["public"]["Enums"]["task_status"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];

const taskTypes = [
  "One-to-One Meeting",
  "Study Plan",
  "Cover Session",
  "Team Meeting",
  "Parent Meeting",
  "Assessment",
  "Recap Session",
  "Session Review",
  "Check Flags",
  "Other",
];

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
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [assignerNames, setAssignerNames] = useState<Record<string, string>>({});

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [formType, setFormType] = useState(taskTypes[0]);
  const [formDescription, setFormDescription] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formDateFrom, setFormDateFrom] = useState("");
  const [formDateTo, setFormDateTo] = useState("");
  const [formStatus, setFormStatus] = useState<TaskStatus>("todo");
  const [formPriority, setFormPriority] = useState(2);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isTeamLeader } = useUserRole();

  const canEditAll = isAdmin || isTeamLeader;

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
        // Fetch profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("mentor_id, mentor_name, team_leader")
          .eq("user_id", user.id)
          .maybeSingle();

        setProfile(profileData);

        // Fetch tasks
        const { data: tasksData, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setTasks(tasksData || []);
        setFilteredTasks(tasksData || []);

        // Fetch assigner names
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

  // Filter tasks
  useEffect(() => {
    let result = tasks;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (task) =>
          task.description.toLowerCase().includes(query) ||
          task.task_type.toLowerCase().includes(query)
      );
    }

    if (filterType) {
      result = result.filter((task) => task.task_type === filterType);
    }

    if (filterStatus) {
      result = result.filter((task) => task.status === filterStatus);
    }

    if (filterDateFrom) {
      result = result.filter(
        (task) => task.date_from && task.date_from >= filterDateFrom
      );
    }

    if (filterDateTo) {
      result = result.filter(
        (task) => task.date_to && task.date_to <= filterDateTo
      );
    }

    setFilteredTasks(result);
  }, [tasks, searchQuery, filterType, filterStatus, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setFilterType("");
    setFilterStatus("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSearchQuery("");
  };

  const resetForm = () => {
    setFormType(taskTypes[0]);
    setFormDescription("");
    setFormLink("");
    setFormDateFrom("");
    setFormDateTo("");
    setFormStatus("todo");
    setFormPriority(2);
  };

  const handleAddTask = async () => {
    if (!user || !formDescription.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in the task description.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.from("tasks").insert({
        user_id: user.id,
        task_type: formType,
        description: formDescription.trim(),
        related_link: formLink.trim() || null,
        date_from: formDateFrom || null,
        date_to: formDateTo || null,
        status: formStatus,
        priority: formPriority,
      }).select().single();

      if (error) throw error;

      setTasks([data, ...tasks]);
      setIsAddModalOpen(false);
      resetForm();
      toast({
        title: "Task Created",
        description: "Your task has been created successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create task.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTask = async () => {
    if (!selectedTask || !formDescription.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in the task description.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .update({
          task_type: formType,
          description: formDescription.trim(),
          related_link: formLink.trim() || null,
          date_from: formDateFrom || null,
          date_to: formDateTo || null,
          status: formStatus,
          priority: formPriority,
        })
        .eq("id", selectedTask.id)
        .select()
        .single();

      if (error) throw error;

      setTasks(tasks.map((t) => (t.id === selectedTask.id ? data : t)));
      setIsEditModalOpen(false);
      setSelectedTask(null);
      resetForm();
      toast({
        title: "Task Updated",
        description: "Your task has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update task.",
        variant: "destructive",
      });
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
      toast({
        title: "Task Archived",
        description: "The task has been archived.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to archive task.",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (status: TaskStatus) => {
    if (!selectedTask) return;
    setTasks(tasks.map((t) => (t.id === selectedTask.id ? { ...t, status } : t)));
    const { error } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", selectedTask.id);
    if (error) {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
      throw error;
    }
    setSelectedTask({ ...selectedTask, status });
    toast({ title: "Status Updated", description: `Task status changed to ${statusLabels[status]}.` });
  };

  const openEditModal = (task: Task) => {
    // Check if task can be fully edited
    const isAssignedTask = !!task.assigned_by;
    if (isAssignedTask && !canEditAll) {
      toast({
        title: "Cannot Edit",
        description: "This task was assigned to you. You can only update the status.",
        variant: "destructive",
      });
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
    setIsEditModalOpen(true);
  };

  const openViewModal = (task: Task) => {
    setSelectedTask(task);
    setIsViewModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/home")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="h-6 w-px bg-border" />
              <Logo variant="blue" className="h-8" />
              <h1 className="font-bold text-lg text-foreground">Task Management</h1>
            </div>
            <Button onClick={() => setIsAddModalOpen(true)} className="bg-gradient-primary hover:opacity-90 gap-2">
              <Plus className="w-4 h-4" />
              Add Task
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl shadow-lg p-4 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
              {(filterType || filterStatus || filterDateFrom || filterDateTo) && (
                <span className="w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center">
                  !
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4 pt-4 border-t border-border"
            >
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Task Type" />
                </SelectTrigger>
                <SelectContent>
                  {taskTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                placeholder="Date From"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />

              <Input
                type="date"
                placeholder="Date To"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />

              <Button variant="secondary" onClick={clearFilters} className="gap-2">
                <X className="w-4 h-4" />
                Clear
              </Button>
            </motion.div>
          )}
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
                    Assigned By
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      {tasks.length === 0
                        ? "No tasks yet. Click 'Add Task' to create your first task."
                        : "No tasks match your filters."}
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const isAssigned = !!task.assigned_by;
                    const assignerName = task.assigned_by ? assignerNames[task.assigned_by] : null;
                    
                    return (
                      <tr key={task.id} className="hover:bg-secondary/50 transition-colors">
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
                          <TaskStatusBadge status={task.status} showIcon />
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-muted-foreground">
                            {task.date_from && task.date_to
                              ? `${task.date_from} → ${task.date_to}`
                              : task.date_from || task.date_to || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {isAssigned ? (
                            <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                              <UserCheck className="w-3 h-3" />
                              {assignerName || "Admin/Leader"}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Self</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openViewModal(task)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {(!isAssigned || canEditAll) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(task)}
                                className="h-8 w-8 p-0"
                              >
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
              Showing {filteredTasks.length} of {tasks.length} tasks
            </p>
          </div>
        </motion.div>
      </main>

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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
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
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={String(formPriority)} onValueChange={(v) => setFormPriority(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Related Link</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={formLink}
                onChange={(e) => setFormLink(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date From</Label>
                <Input
                  type="date"
                  value={formDateFrom}
                  onChange={(e) => setFormDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date To</Label>
                <Input
                  type="date"
                  value={formDateTo}
                  onChange={(e) => setFormDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.filter(s => s !== "archived").map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
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
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={String(formPriority)} onValueChange={(v) => setFormPriority(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Related Link</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={formLink}
                onChange={(e) => setFormLink(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date From</Label>
                <Input
                  type="date"
                  value={formDateFrom}
                  onChange={(e) => setFormDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date To</Label>
                <Input
                  type="date"
                  value={formDateTo}
                  onChange={(e) => setFormDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
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
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedTask(null);
        }}
        onEdit={() => {
          setIsViewModalOpen(false);
          if (selectedTask) openEditModal(selectedTask);
        }}
        onStatusChange={handleStatusChange}
        canEditAll={canEditAll}
        assignerName={selectedTask?.assigned_by ? assignerNames[selectedTask.assigned_by] : undefined}
      />
    </div>
  );
};

export default Tasks;
