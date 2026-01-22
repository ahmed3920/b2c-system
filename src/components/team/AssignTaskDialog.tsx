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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

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

const taskSchema = z.object({
  mentorId: z.string().min(1, "Please select a mentor"),
  taskType: z.string().min(1, "Task type is required"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  dateFrom: z.string().min(1, "Start date is required"),
  dateTo: z.string().min(1, "End date is required"),
  priority: z.string(),
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
  const [formData, setFormData] = useState({
    mentorId: "",
    taskType: "",
    description: "",
    relatedLink: "",
    dateFrom: "",
    dateTo: "",
    priority: "2",
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
    });
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = taskSchema.safeParse(formData);
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

      // Get team leader's profile
      const { data: tlProfile } = await supabase
        .from("profiles")
        .select("mentor_name")
        .eq("user_id", session.user.id)
        .single();

      const { error: insertError } = await supabase.from("tasks").insert({
        user_id: formData.mentorId,
        task_type: formData.taskType,
        description: formData.description,
        related_link: formData.relatedLink || null,
        date_from: formData.dateFrom,
        date_to: formData.dateTo,
        priority: parseInt(formData.priority),
        status: "todo",
        assigned_by: session.user.id,
        created_by: session.user.id,
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
      <DialogContent className="sm:max-w-[500px]">
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
