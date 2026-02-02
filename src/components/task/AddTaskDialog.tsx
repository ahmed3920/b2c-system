import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
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
import { Loader2, Calendar, Shield, Users, UserCircle, Lock } from "lucide-react";
import { RoleBadge } from "@/components/RoleBadge";
import type { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["task_status"];

interface TaskFormField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  field_options: unknown;
  is_required: boolean;
  is_system_field: boolean;
  display_order: number;
  is_active: boolean;
}

interface OwnerInfo {
  userId: string;
  name: string;
  mentorId: string;
  role: AppRole;
}

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: (task: Database["public"]["Tables"]["tasks"]["Row"]) => void;
  currentUserId: string;
  ownerInfo: OwnerInfo | null;
}

const defaultTaskTypes = [
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

const statusOptions: TaskStatus[] = ["todo", "in_progress", "done"];
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

export function AddTaskDialog({
  open,
  onOpenChange,
  onTaskCreated,
  currentUserId,
  ownerInfo,
}: AddTaskDialogProps) {
  const { toast } = useToast();
  const { role } = useUserRole();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formFields, setFormFields] = useState<TaskFormField[]>([]);
  
  // Form state
  const [hasDeadline, setHasDeadline] = useState(true);
  const [formData, setFormData] = useState({
    taskType: defaultTaskTypes[0],
    description: "",
    relatedLink: "",
    dateFrom: "",
    dateTo: "",
    status: "todo" as TaskStatus,
    priority: 2,
  });
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      fetchFormFields();
    }
  }, [open]);

  const fetchFormFields = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("task_form_fields")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setFormFields(data || []);
    } catch (error) {
      console.error("Failed to load form fields:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      taskType: defaultTaskTypes[0],
      description: "",
      relatedLink: "",
      dateFrom: "",
      dateTo: "",
      status: "todo",
      priority: 2,
    });
    setCustomFields({});
    setHasDeadline(true);
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (hasDeadline) {
      if (!formData.dateFrom) {
        newErrors.dateFrom = "Start date is required when deadline is enabled";
      }
      if (!formData.dateTo) {
        newErrors.dateTo = "Due date is required when deadline is enabled";
      }
      if (formData.dateFrom && formData.dateTo && formData.dateFrom > formData.dateTo) {
        newErrors.dateTo = "Due date must be after start date";
      }
    }

    // Validate required custom fields
    formFields
      .filter((f) => !f.is_system_field && f.is_required && f.is_active)
      .forEach((field) => {
        if (!customFields[field.field_name]?.trim()) {
          newErrors[field.field_name] = `${field.field_label} is required`;
        }
      });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const taskData = {
        user_id: currentUserId,
        task_type: formData.taskType,
        description: formData.description.trim(),
        related_link: formData.relatedLink.trim() || null,
        date_from: hasDeadline ? formData.dateFrom : null,
        date_to: hasDeadline ? formData.dateTo : null,
        status: formData.status,
        priority: formData.priority,
        created_by: currentUserId,
      };

      const { data, error } = await supabase
        .from("tasks")
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Task Created",
        description: "Your task has been created successfully.",
      });

      onTaskCreated(data);
      resetForm();
      onOpenChange(false);
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

  const getRoleIcon = (userRole: AppRole) => {
    switch (userRole) {
      case "admin":
        return <Shield className="w-5 h-5 text-destructive" />;
      case "team_leader":
        return <Users className="w-5 h-5 text-amber-600" />;
      default:
        return <UserCircle className="w-5 h-5 text-primary" />;
    }
  };

  // Get custom form fields (non-system fields)
  const customFormFields = formFields.filter((f) => !f.is_system_field && f.is_active);

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) resetForm();
      onOpenChange(value);
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {/* Task Owner Info - Auto-filled & Read-only */}
            {ownerInfo && (
              <div className="p-3 bg-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center">
                    {getRoleIcon(ownerInfo.role)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{ownerInfo.name}</span>
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">ID: {ownerInfo.mentorId}</span>
                      <span className="text-muted-foreground">•</span>
                      <RoleBadge role={ownerInfo.role} size="sm" />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Task owner is auto-assigned based on your account
                </p>
              </div>
            )}

            {/* Task Type */}
            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select
                value={formData.taskType}
                onValueChange={(v) => setFormData({ ...formData, taskType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {defaultTaskTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Enter task description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={errors.description ? "border-destructive" : ""}
                rows={3}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description}</p>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={String(formData.priority)}
                onValueChange={(v) => setFormData({ ...formData, priority: Number(v) })}
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

            {/* Related Link */}
            <div className="space-y-2">
              <Label>Related Link</Label>
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

            {/* Date Fields - Conditional */}
            {hasDeadline && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date From *</Label>
                  <Input
                    type="date"
                    value={formData.dateFrom}
                    onChange={(e) => setFormData({ ...formData, dateFrom: e.target.value })}
                    className={errors.dateFrom ? "border-destructive" : ""}
                  />
                  {errors.dateFrom && (
                    <p className="text-xs text-destructive">{errors.dateFrom}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Date To *</Label>
                  <Input
                    type="date"
                    value={formData.dateTo}
                    onChange={(e) => setFormData({ ...formData, dateTo: e.target.value })}
                    className={errors.dateTo ? "border-destructive" : ""}
                  />
                  {errors.dateTo && (
                    <p className="text-xs text-destructive">{errors.dateTo}</p>
                  )}
                </div>
              </div>
            )}

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v as TaskStatus })}
              >
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

            {/* Custom Fields from task_form_fields */}
            {customFormFields.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-border">
                <p className="text-sm font-medium text-muted-foreground">Additional Fields</p>
                {customFormFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label>
                      {field.field_label}
                      {field.is_required && " *"}
                    </Label>
                    {field.field_type === "textarea" ? (
                      <Textarea
                        placeholder={`Enter ${field.field_label.toLowerCase()}...`}
                        value={customFields[field.field_name] || ""}
                        onChange={(e) =>
                          setCustomFields({ ...customFields, [field.field_name]: e.target.value })
                        }
                        className={errors[field.field_name] ? "border-destructive" : ""}
                      />
                    ) : field.field_type === "select" && Array.isArray(field.field_options) ? (
                      <Select
                        value={customFields[field.field_name] || ""}
                        onValueChange={(v) =>
                          setCustomFields({ ...customFields, [field.field_name]: v })
                        }
                      >
                        <SelectTrigger className={errors[field.field_name] ? "border-destructive" : ""}>
                          <SelectValue placeholder={`Select ${field.field_label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.field_options as string[]).map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.field_type === "date" ? (
                      <Input
                        type="date"
                        value={customFields[field.field_name] || ""}
                        onChange={(e) =>
                          setCustomFields({ ...customFields, [field.field_name]: e.target.value })
                        }
                        className={errors[field.field_name] ? "border-destructive" : ""}
                      />
                    ) : field.field_type === "number" ? (
                      <Input
                        type="number"
                        placeholder={`Enter ${field.field_label.toLowerCase()}...`}
                        value={customFields[field.field_name] || ""}
                        onChange={(e) =>
                          setCustomFields({ ...customFields, [field.field_name]: e.target.value })
                        }
                        className={errors[field.field_name] ? "border-destructive" : ""}
                      />
                    ) : field.field_type === "url" ? (
                      <Input
                        type="url"
                        placeholder="https://..."
                        value={customFields[field.field_name] || ""}
                        onChange={(e) =>
                          setCustomFields({ ...customFields, [field.field_name]: e.target.value })
                        }
                        className={errors[field.field_name] ? "border-destructive" : ""}
                      />
                    ) : (
                      <Input
                        type="text"
                        placeholder={`Enter ${field.field_label.toLowerCase()}...`}
                        value={customFields[field.field_name] || ""}
                        onChange={(e) =>
                          setCustomFields({ ...customFields, [field.field_name]: e.target.value })
                        }
                        className={errors[field.field_name] ? "border-destructive" : ""}
                      />
                    )}
                    {errors[field.field_name] && (
                      <p className="text-xs text-destructive">{errors[field.field_name]}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-gradient-primary">
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Task
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
