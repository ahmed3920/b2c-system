import { useState, useEffect } from "react";
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
import { Loader2, Calendar } from "lucide-react";
import { TaskTimeRange, calculateDurationMinutes } from "@/components/task/TaskTimeRange";

interface TeamMember {
  user_id: string;
  mentor_id: string;
  mentor_name: string;
  full_name: string | null;
}

interface AssignTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: TeamMember[];
  selectedMember: TeamMember | null;
  onTaskAssigned: () => void;
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

const priorityOptions = [
  { value: "1", label: "Low", color: "text-green-600" },
  { value: "2", label: "Normal", color: "text-blue-600" },
  { value: "3", label: "High", color: "text-orange-600" },
  { value: "4", label: "Critical", color: "text-red-600" },
];

const baseTaskSchema = z.object({
  mentorId: z.string().min(1, "Please select a mentor"),
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

export function AssignTaskDialog({
  open,
  onOpenChange,
  teamMembers,
  selectedMember,
  onTaskAssigned,
}: AssignTaskDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasDeadline, setHasDeadline] = useState(true);
  const [formData, setFormData] = useState({
    mentorId: "",
    taskType: "",
    description: "",
    relatedLink: "",
    dateFrom: "",
    dateTo: "",
    priority: "2",
    startTime: "",
    endTime: "",
  });

  useEffect(() => {
    if (selectedMember) {
      setFormData((prev) => ({ ...prev, mentorId: selectedMember.user_id }));
    }
  }, [selectedMember]);

  const resetForm = () => {
    setFormData({
      mentorId: selectedMember?.user_id || "",
      taskType: "",
      description: "",
      relatedLink: "",
      dateFrom: "",
      dateTo: "",
      priority: "2",
      startTime: "",
      endTime: "",
    });
    setErrors({});
    setHasDeadline(true);
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

    setIsSubmitting(true);
    setErrors({});

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const selectedMentorData = teamMembers.find((m) => m.user_id === formData.mentorId);
      if (!selectedMentorData) throw new Error("Mentor not found");

      const durationMins = calculateDurationMinutes(formData.startTime, formData.endTime);
      const { error: insertError } = await supabase.from("tasks").insert({
        user_id: formData.mentorId,
        task_type: formData.taskType,
        description: formData.description,
        related_link: formData.relatedLink || null,
        date_from: hasDeadline ? formData.dateFrom : null,
        date_to: hasDeadline ? formData.dateTo : null,
        priority: parseInt(formData.priority),
        status: "todo",
        assigned_by: session.user.id,
        created_by: session.user.id,
        start_time: formData.startTime || null,
        end_time: formData.endTime || null,
        duration_minutes: durationMins || null,
      });

      if (insertError) throw insertError;

      toast({
        title: "Task Assigned",
        description: `Task assigned to ${selectedMentorData.mentor_name}`,
      });

      resetForm();
      onOpenChange(false);
      onTaskAssigned();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to assign task";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Task to Team Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mentor">Assign To *</Label>
            <Select
              value={formData.mentorId}
              onValueChange={(value) => setFormData({ ...formData, mentorId: value })}
            >
              <SelectTrigger className={errors.mentorId ? "border-destructive" : ""}>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.full_name || member.mentor_name} ({member.mentor_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.mentorId && <p className="text-xs text-destructive">{errors.mentorId}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taskType">Task Type *</Label>
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
              <Label htmlFor="priority">Priority</Label>
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
                      <span className={opt.color}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the task..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={errors.description ? "border-destructive" : ""}
              rows={3}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="relatedLink">Related Link (optional)</Label>
            <Input
              id="relatedLink"
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
                <Label htmlFor="dateFrom">Start Date *</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={formData.dateFrom}
                  onChange={(e) => setFormData({ ...formData, dateFrom: e.target.value })}
                  className={errors.dateFrom ? "border-destructive" : ""}
                />
                {errors.dateFrom && <p className="text-xs text-destructive">{errors.dateFrom}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">Due Date *</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={formData.dateTo}
                  onChange={(e) => setFormData({ ...formData, dateTo: e.target.value })}
                  className={errors.dateTo ? "border-destructive" : ""}
                />
                {errors.dateTo && <p className="text-xs text-destructive">{errors.dateTo}</p>}
              </div>
            </div>
          )}

          {/* Time Range */}
          <TaskTimeRange
            startTime={formData.startTime}
            endTime={formData.endTime}
            onStartTimeChange={(v) => setFormData({ ...formData, startTime: v })}
            onEndTimeChange={(v) => setFormData({ ...formData, endTime: v })}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Assign Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
