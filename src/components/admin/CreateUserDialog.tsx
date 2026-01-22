import { useState } from "react";
import { z } from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Eye, EyeOff } from "lucide-react";
import type { CreateUserData } from "@/hooks/useAdminUsers";
import type { AppRole } from "@/hooks/useUserRole";

const createUserSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name is required"),
  mentorId: z.string().min(1, "Mentor ID is required"),
  mentorName: z.string().min(2, "Mentor name is required"),
  teamLeader: z.string().min(1, "Team leader is required"),
  role: z.enum(["admin", "team_leader", "mentor"]),
});

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateUserData) => Promise<{ success: boolean }>;
  teamLeaders: string[];
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onSubmit,
  teamLeaders,
}: CreateUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    mentorId: "",
    mentorName: "",
    teamLeader: "",
    role: "mentor" as AppRole,
  });

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      fullName: "",
      mentorId: "",
      mentorName: "",
      teamLeader: "",
      role: "mentor",
    });
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = createUserSchema.safeParse(formData);
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

    const response = await onSubmit(formData);
    
    setIsSubmitting(false);
    
    if (response.success) {
      resetForm();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) resetForm();
      onOpenChange(value);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@ischool.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 6 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={errors.password ? "border-destructive pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className={errors.fullName ? "border-destructive" : ""}
              />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="mentorId">Mentor ID *</Label>
              <Input
                id="mentorId"
                placeholder="T-1001"
                value={formData.mentorId}
                onChange={(e) => setFormData({ ...formData, mentorId: e.target.value })}
                className={errors.mentorId ? "border-destructive" : ""}
              />
              {errors.mentorId && <p className="text-xs text-destructive">{errors.mentorId}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mentorName">Mentor Name *</Label>
            <Input
              id="mentorName"
              placeholder="Mentor display name"
              value={formData.mentorName}
              onChange={(e) => setFormData({ ...formData, mentorName: e.target.value })}
              className={errors.mentorName ? "border-destructive" : ""}
            />
            {errors.mentorName && <p className="text-xs text-destructive">{errors.mentorName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="teamLeader">Team Leader *</Label>
              <Select
                value={formData.teamLeader}
                onValueChange={(value) => setFormData({ ...formData, teamLeader: value })}
              >
                <SelectTrigger className={errors.teamLeader ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select team leader" />
                </SelectTrigger>
                <SelectContent>
                  {teamLeaders.map((tl) => (
                    <SelectItem key={tl} value={tl}>
                      {tl}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">+ Add new team leader</SelectItem>
                </SelectContent>
              </Select>
              {formData.teamLeader === "__new__" && (
                <Input
                  placeholder="Enter new team leader name"
                  onChange={(e) => setFormData({ ...formData, teamLeader: e.target.value })}
                  className="mt-2"
                />
              )}
              {errors.teamLeader && <p className="text-xs text-destructive">{errors.teamLeader}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: AppRole) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mentor">Mentor</SelectItem>
                  <SelectItem value="team_leader">Team Leader</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
