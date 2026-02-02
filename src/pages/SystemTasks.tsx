import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Loader2,
  Search,
  Filter,
  X,
  Eye,
  Edit,
  UserCircle,
  Users,
  Shield,
  Calendar,
  CalendarOff,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import { RoleBadge } from "@/components/RoleBadge";
import { TaskPriorityBadge } from "@/components/task/TaskPriorityBadge";
import { TaskStatusBadge } from "@/components/task/TaskStatusBadge";
import { TaskDueDateBadge } from "@/components/task/TaskDueDateBadge";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "@/hooks/useUserRole";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskStatus = Database["public"]["Enums"]["task_status"];

interface TaskWithOwner extends Task {
  owner_name?: string;
  owner_role?: AppRole;
  owner_mentor_id?: string;
}

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

const SystemTasks = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  
  const [tasks, setTasks] = useState<TaskWithOwner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDeadline, setFilterDeadline] = useState(""); // "with" | "without" | ""
  
  // Unique owners for filter dropdown
  const [owners, setOwners] = useState<{ id: string; name: string; mentor_id: string }[]>([]);
  
  // Edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithOwner | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    taskType: "",
    description: "",
    relatedLink: "",
    dateFrom: "",
    dateTo: "",
    status: "todo" as TaskStatus,
    priority: 2,
    hasDeadline: true,
  });

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/home");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchTasks();
    }
  }, [isAdmin]);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      // Fetch all tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (tasksError) throw tasksError;

      // Get unique user IDs
      const userIds = [...new Set((tasksData || []).map(t => t.user_id))];
      
      // Fetch profiles for owners
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, mentor_name, mentor_id, full_name")
        .in("user_id", userIds);

      // Fetch roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const tasksWithOwner: TaskWithOwner[] = (tasksData || []).map(task => {
        const profile = profileMap.get(task.user_id);
        return {
          ...task,
          owner_name: profile?.full_name || profile?.mentor_name || "Unknown",
          owner_role: (roleMap.get(task.user_id) || "mentor") as AppRole,
          owner_mentor_id: profile?.mentor_id || "N/A",
        };
      });

      setTasks(tasksWithOwner);

      // Build unique owners list
      const uniqueOwners = new Map<string, { id: string; name: string; mentor_id: string }>();
      tasksWithOwner.forEach(t => {
        if (!uniqueOwners.has(t.user_id)) {
          uniqueOwners.set(t.user_id, {
            id: t.user_id,
            name: t.owner_name || "Unknown",
            mentor_id: t.owner_mentor_id || "N/A",
          });
        }
      });
      setOwners(Array.from(uniqueOwners.values()));

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load system tasks",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Search by task description, user name, or user ID
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.description.toLowerCase().includes(query) ||
        t.task_type.toLowerCase().includes(query) ||
        t.owner_name?.toLowerCase().includes(query) ||
        t.owner_mentor_id?.toLowerCase().includes(query)
      );
    }

    // Filter by role
    if (filterRole) {
      result = result.filter(t => t.owner_role === filterRole);
    }

    // Filter by owner
    if (filterOwner) {
      result = result.filter(t => t.user_id === filterOwner);
    }

    // Filter by status
    if (filterStatus) {
      result = result.filter(t => t.status === filterStatus);
    }

    // Filter by deadline
    if (filterDeadline === "with") {
      result = result.filter(t => t.date_from && t.date_to);
    } else if (filterDeadline === "without") {
      result = result.filter(t => !t.date_from || !t.date_to);
    }

    return result;
  }, [tasks, searchQuery, filterRole, filterOwner, filterStatus, filterDeadline]);

  const clearFilters = () => {
    setSearchQuery("");
    setFilterRole("");
    setFilterOwner("");
    setFilterStatus("");
    setFilterDeadline("");
  };

  const hasActiveFilters = !!(filterRole || filterOwner || filterStatus || filterDeadline);

  const openEditModal = (task: TaskWithOwner) => {
    setSelectedTask(task);
    setEditForm({
      taskType: task.task_type,
      description: task.description,
      relatedLink: task.related_link || "",
      dateFrom: task.date_from || "",
      dateTo: task.date_to || "",
      status: task.status,
      priority: task.priority || 2,
      hasDeadline: !!(task.date_from || task.date_to),
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedTask) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          task_type: editForm.taskType,
          description: editForm.description.trim(),
          related_link: editForm.relatedLink.trim() || null,
          date_from: editForm.hasDeadline ? editForm.dateFrom : null,
          date_to: editForm.hasDeadline ? editForm.dateTo : null,
          status: editForm.status,
          priority: editForm.priority,
        })
        .eq("id", selectedTask.id);

      if (error) throw error;

      setTasks(tasks.map(t =>
        t.id === selectedTask.id
          ? {
              ...t,
              task_type: editForm.taskType,
              description: editForm.description.trim(),
              related_link: editForm.relatedLink.trim() || null,
              date_from: editForm.hasDeadline ? editForm.dateFrom : null,
              date_to: editForm.hasDeadline ? editForm.dateTo : null,
              status: editForm.status,
              priority: editForm.priority,
            }
          : t
      ));

      toast({ title: "Task Updated", description: "Changes saved successfully" });
      setIsEditModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (roleLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Logo variant="blue" className="h-8" />
              <div className="h-6 w-px bg-border" />
              <span className="font-semibold text-foreground">All System Tasks</span>
            </div>
            <Button variant="outline" size="sm" onClick={fetchTasks}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl shadow-lg p-6 mb-6"
        >
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by task, user name, or user ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? "border-primary text-primary" : ""}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters {hasActiveFilters && `(${[filterRole, filterOwner, filterStatus, filterDeadline].filter(Boolean).length})`}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-border">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Role</Label>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="team_leader">Team Leader</SelectItem>
                    <SelectItem value="mentor">Mentor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Task Owner</Label>
                <Select value={filterOwner} onValueChange={setFilterOwner}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Owners" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Owners</SelectItem>
                    {owners.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.name} ({owner.mentor_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Deadline</Label>
                <Select value={filterDeadline} onValueChange={setFilterDeadline}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Tasks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tasks</SelectItem>
                    <SelectItem value="with">With Deadline</SelectItem>
                    <SelectItem value="without">No Deadline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Task
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Deadline
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      {tasks.length === 0 ? "No tasks in the system." : "No tasks match your filters."}
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            {task.owner_role === "admin" && <Shield className="w-4 h-4 text-destructive" />}
                            {task.owner_role === "team_leader" && <Users className="w-4 h-4 text-amber-600" />}
                            {task.owner_role === "mentor" && <UserCircle className="w-4 h-4 text-primary" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-foreground">{task.owner_name}</p>
                            <p className="text-xs text-muted-foreground">{task.owner_mentor_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <RoleBadge role={task.owner_role || null} size="sm" />
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-xs px-2 py-1 bg-secondary rounded inline-block font-medium mb-1">
                          {task.task_type}
                        </p>
                        <p className="text-sm text-foreground line-clamp-2 max-w-xs">
                          {task.description}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <TaskPriorityBadge priority={task.priority || 2} />
                      </td>
                      <td className="px-4 py-4">
                        <TaskStatusBadge status={task.status} showIcon />
                      </td>
                      <td className="px-4 py-4">
                        {task.date_from && task.date_to ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-muted-foreground">
                              {task.date_from} → {task.date_to}
                            </span>
                            <TaskDueDateBadge dateTo={task.date_to} status={task.status} size="sm" />
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarOff className="w-3 h-3" />
                            No deadline
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(task)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-border bg-secondary/50">
            <p className="text-sm text-muted-foreground">
              Showing {filteredTasks.length} of {tasks.length} system tasks
            </p>
          </div>
        </motion.div>
      </main>

      {/* Edit Task Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4 py-4">
              {/* Owner Info */}
              <div className="p-3 bg-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {selectedTask.owner_role === "admin" && <Shield className="w-5 h-5 text-destructive" />}
                    {selectedTask.owner_role === "team_leader" && <Users className="w-5 h-5 text-amber-600" />}
                    {selectedTask.owner_role === "mentor" && <UserCircle className="w-5 h-5 text-primary" />}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{selectedTask.owner_name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{selectedTask.owner_mentor_id}</span>
                      <RoleBadge role={selectedTask.owner_role || null} size="sm" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Task Type</Label>
                <Select
                  value={editForm.taskType}
                  onValueChange={(v) => setEditForm({ ...editForm, taskType: v })}
                >
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
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={String(editForm.priority)}
                  onValueChange={(v) => setEditForm({ ...editForm, priority: Number(v) })}
                >
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
                  value={editForm.relatedLink}
                  onChange={(e) => setEditForm({ ...editForm, relatedLink: e.target.value })}
                />
              </div>

              {/* Deadline Toggle */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Has Deadline</span>
                </div>
                <Switch
                  checked={editForm.hasDeadline}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, hasDeadline: checked })}
                />
              </div>

              {editForm.hasDeadline && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date From</Label>
                    <Input
                      type="date"
                      value={editForm.dateFrom}
                      onChange={(e) => setEditForm({ ...editForm, dateFrom: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date To</Label>
                    <Input
                      type="date"
                      value={editForm.dateTo}
                      onChange={(e) => setEditForm({ ...editForm, dateTo: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v as TaskStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SystemTasks;
