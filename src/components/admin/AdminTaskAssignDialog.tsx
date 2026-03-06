import { useState, useEffect } from "react";
import { useTaskCategories } from "@/hooks/useTaskCategories";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, User, UserCheck, Calendar, Search } from "lucide-react";

interface UserOption {
  user_id: string;
  mentor_name: string;
  full_name: string | null;
  role: string;
  team_leader: string;
}

interface AdminTaskAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskAssigned: () => void;
}

const fallbackTaskTypes = ["Other"];

const priorityOptions = [
  { value: "1", label: "Low" },
  { value: "2", label: "Medium" },
  { value: "3", label: "High" },
  { value: "4", label: "Urgent" },
];

type AssignmentType = "all_team_leaders" | "selected_team_leader" | "specific_user";

const baseTaskSchema = z.object({
  taskType: z.string().min(1, "Task type is required"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  priority: z.string(),
});

const taskWithDeadlineSchema = baseTaskSchema.extend({
  dateFrom: z.string().min(1, "Start date is required"),
  dateTo: z.string().min(1, "End date is required"),
});

const taskWithoutDeadlineSchema = baseTaskSchema.extend({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

function UserSelectionWithSearch({
  users,
  selectedUsers,
  onUserSelect,
  label,
  error,
}: {
  users: UserOption[];
  selectedUsers: string[];
  onUserSelect: (userId: string, checked: boolean) => void;
  label: string;
  error?: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.mentor_name.toLowerCase().includes(q) ||
      (u.full_name?.toLowerCase().includes(q)) ||
      u.user_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>
      <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">No users found</p>
        ) : (
          filtered.map((user) => (
            <label
              key={user.user_id}
              className="flex items-center gap-2 p-2 rounded hover:bg-secondary cursor-pointer"
            >
              <Checkbox
                checked={selectedUsers.includes(user.user_id)}
                onCheckedChange={(checked) => onUserSelect(user.user_id, checked as boolean)}
              />
              <span className="text-sm">
                {user.full_name || user.mentor_name}
                <span className="text-muted-foreground ml-1">({user.role})</span>
              </span>
            </label>
          ))
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function AdminTaskAssignDialog({
  open,
  onOpenChange,
  onTaskAssigned,
}: AdminTaskAssignDialogProps) {
  const { toast } = useToast();
  // Admin assigns to mentors, so use mentor categories
  const { categories: dbCategories } = useTaskCategories("mentor");
  const taskTypes = dbCategories.length > 0 ? dbCategories : fallbackTaskTypes;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("specific_user");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<UserOption[]>([]);
  const [hasDeadline, setHasDeadline] = useState(true);
  
  const [formData, setFormData] = useState({
    taskType: "",
    description: "",
    relatedLink: "",
    dateFrom: "",
    dateTo: "",
    priority: "2",
  });

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      // Fetch all profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, mentor_name, full_name, team_leader")
        .eq("active_status", true);

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      
      const usersWithRoles: UserOption[] = (profiles || []).map(p => ({
        ...p,
        role: roleMap.get(p.user_id) || "mentor",
      }));

      setAllUsers(usersWithRoles);
      setTeamLeaders(usersWithRoles.filter(u => u.role === "team_leader"));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const resetForm = () => {
    setFormData({
      taskType: "",
      description: "",
      relatedLink: "",
      dateFrom: "",
      dateTo: "",
      priority: "2",
    });
    setAssignmentType("specific_user");
    setSelectedUsers([]);
    setErrors({});
    setHasDeadline(true);
  };

  const getTargetUsers = (): string[] => {
    switch (assignmentType) {
      case "all_team_leaders":
        return teamLeaders.map(tl => tl.user_id);
      case "selected_team_leader":
        // Get the selected team leader and all mentors under them
        if (selectedUsers.length === 0) return [];
        const selectedTL = teamLeaders.find(tl => tl.user_id === selectedUsers[0]);
        if (!selectedTL) return selectedUsers;
        const teamMentors = allUsers.filter(
          u => u.team_leader === selectedTL.mentor_name && u.role === "mentor"
        );
        return [selectedUsers[0], ...teamMentors.map(m => m.user_id)];
      case "specific_user":
        return selectedUsers;
      default:
        return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const schema = hasDeadline ? taskWithDeadlineSchema : taskWithoutDeadlineSchema;
    const result = schema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    const targetUsers = getTargetUsers();
    if (targetUsers.length === 0) {
      setErrors({ assignment: "Please select at least one user to assign the task to" });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Create tasks for all target users
      const tasksToInsert = targetUsers.map(userId => ({
        user_id: userId,
        task_type: formData.taskType,
        description: formData.description,
        related_link: formData.relatedLink || null,
        date_from: hasDeadline ? formData.dateFrom : null,
        date_to: hasDeadline ? formData.dateTo : null,
        priority: parseInt(formData.priority),
        status: "todo" as const,
        assigned_by: session.user.id,
        created_by: session.user.id,
      }));

      const { error: insertError } = await supabase.from("tasks").insert(tasksToInsert);

      if (insertError) throw insertError;

      toast({
        title: "Tasks Assigned",
        description: `Task assigned to ${targetUsers.length} user(s) successfully`,
      });

      resetForm();
      onOpenChange(false);
      onTaskAssigned();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to assign tasks";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUserSelect = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    }
  };

  const getFilteredUsers = () => {
    switch (assignmentType) {
      case "selected_team_leader":
        return teamLeaders;
      case "specific_user":
        return allUsers;
      default:
        return [];
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetForm();
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Task (Admin)</DialogTitle>
        </DialogHeader>
        
        {isLoadingUsers ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Assignment Type Selection */}
            <div className="space-y-3">
              <Label>Assign To</Label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssignmentType("all_team_leaders");
                    setSelectedUsers([]);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    assignmentType === "all_team_leaders"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">All Team Leaders</p>
                    <p className="text-xs text-muted-foreground">
                      Assign to {teamLeaders.length} team leader(s)
                    </p>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setAssignmentType("selected_team_leader");
                    setSelectedUsers([]);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    assignmentType === "selected_team_leader"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <UserCheck className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Selected Team Leader & Team</p>
                    <p className="text-xs text-muted-foreground">
                      Assign to a team leader and all their mentors
                    </p>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setAssignmentType("specific_user");
                    setSelectedUsers([]);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    assignmentType === "specific_user"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <User className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Specific User(s)</p>
                    <p className="text-xs text-muted-foreground">
                      Choose individual users to assign
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* User Selection (for selected_team_leader and specific_user) */}
            {assignmentType !== "all_team_leaders" && (
              <UserSelectionWithSearch
                users={getFilteredUsers()}
                selectedUsers={selectedUsers}
                onUserSelect={handleUserSelect}
                label={assignmentType === "selected_team_leader" ? "Select Team Leader" : "Select Users"}
                error={errors.assignment}
              />
            )}

            {/* Task Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Task Type *</Label>
                <Select
                  value={formData.taskType}
                  onValueChange={(value) => setFormData({ ...formData, taskType: value })}
                >
                  <SelectTrigger className={errors.taskType ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.taskType && <p className="text-xs text-destructive">{errors.taskType}</p>}
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Describe the task..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={errors.description ? "border-destructive" : ""}
                rows={3}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            <div className="space-y-2">
              <Label>Related Link (optional)</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={formData.relatedLink}
                onChange={(e) => setFormData({ ...formData, relatedLink: e.target.value })}
              />
            </div>

            {/* Deadline Toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">Has Deadline?</span>
                  <p className="text-xs text-muted-foreground">
                    {hasDeadline ? "Date range is required" : "Task has no specific deadline"}
                  </p>
                </div>
              </div>
              <Switch checked={hasDeadline} onCheckedChange={setHasDeadline} />
            </div>

            {hasDeadline && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.dateFrom}
                    onChange={(e) => setFormData({ ...formData, dateFrom: e.target.value })}
                    className={errors.dateFrom ? "border-destructive" : ""}
                  />
                  {errors.dateFrom && <p className="text-xs text-destructive">{errors.dateFrom}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Due Date *</Label>
                  <Input
                    type="date"
                    value={formData.dateTo}
                    onChange={(e) => setFormData({ ...formData, dateTo: e.target.value })}
                    className={errors.dateTo ? "border-destructive" : ""}
                  />
                  {errors.dateTo && <p className="text-xs text-destructive">{errors.dateTo}</p>}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Assign Task{getTargetUsers().length > 1 ? `s (${getTargetUsers().length})` : ""}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
