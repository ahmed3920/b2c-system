import { useState, useEffect } from "react";
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
import { Loader2, Eye, EyeOff, Shield, Users, UserCircle, ChevronRight, ChevronLeft, Globe, Crown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { CreateUserData } from "@/hooks/useAdminUsers";
import type { AppRole } from "@/hooks/useUserRole";

type UserType = "admin" | "team_leader" | "super_team_leader" | "mentor" | "community_moderator";

interface UserTypeOption {
  value: UserType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const userTypes: UserTypeOption[] = [
  {
    value: "admin",
    label: "New Admin",
    description: "Full system access and user management",
    icon: <Shield className="w-6 h-6" />,
  },
  {
    value: "team_leader",
    label: "New Team Leader",
    description: "Manage team members and assign tasks",
    icon: <Users className="w-6 h-6" />,
  },
  {
    value: "super_team_leader",
    label: "New Super Team Leader",
    description: "Team leader with cross-team CS ticket access",
    icon: <Crown className="w-6 h-6" />,
  },
  {
    value: "mentor",
    label: "New Mentor",
    description: "Track personal tasks and progress",
    icon: <UserCircle className="w-6 h-6" />,
  },
  {
    value: "community_moderator",
    label: "New Community Moderator",
    description: "Moderate community and track tasks like a mentor",
    icon: <Globe className="w-6 h-6" />,
  },
];

const adminSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name is required"),
  mentorId: z.string().optional(),
});


const teamLeaderSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name is required"),
  teamName: z.string().min(2, "Team name is required"),
  mentorId: z.string().optional(),
});

const mentorSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name is required"),
  teamLeader: z.string().min(1, "Team leader is required"),
  mentorId: z.string().optional(),
});

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateUserData) => Promise<{ success: boolean }>;
  teamLeaders: string[];
  existingTeamLeaderUsers?: { name: string; team: string }[];
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onSubmit,
  teamLeaders,
  existingTeamLeaderUsers = [],
}: CreateUserDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    teamName: "",
    teamLeader: "",
    mentorId: "",
    useCustomMentorId: false,
  });
  
  const [mentorIdError, setMentorIdError] = useState("");

  const resetForm = () => {
    setStep(1);
    setSelectedType(null);
    setFormData({
      email: "",
      password: "",
      fullName: "",
      teamName: "",
      teamLeader: "",
      mentorId: "",
      useCustomMentorId: false,
    });
    setErrors({});
    setMentorIdError("");
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  // Auto-populate team when team leader is selected for mentors
  const selectedTeamLeaderTeam = existingTeamLeaderUsers.find(
    (tl) => tl.name === formData.teamLeader
  )?.team;

  const validateForm = () => {
    let schema;
    let dataToValidate;

    switch (selectedType) {
      case "admin":
        schema = adminSchema;
        dataToValidate = {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
        };
        break;
      case "team_leader":
      case "super_team_leader":
        schema = teamLeaderSchema;
        dataToValidate = {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          teamName: formData.teamName,
        };
        break;
      case "mentor":
      case "community_moderator":
        schema = mentorSchema;
        dataToValidate = {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          teamLeader: formData.teamLeader,
        };
        break;
      default:
        return false;
    }

    const result = schema.safeParse(dataToValidate);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !selectedType) return;

    setIsSubmitting(true);

    // Build the create user data based on selected type
    let createData: CreateUserData;
    const generatedMentorId = `U-${Date.now().toString(36).toUpperCase()}`;
    const finalMentorId = formData.useCustomMentorId && formData.mentorId.trim() 
      ? formData.mentorId.trim() 
      : generatedMentorId;

    switch (selectedType) {
      case "admin":
        createData = {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          mentorId: finalMentorId,
          mentorName: formData.fullName,
          teamLeader: "System Admin",
          role: "admin",
        };
        break;
      case "team_leader":
      case "super_team_leader":
        createData = {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          mentorId: finalMentorId,
          mentorName: formData.fullName,
          teamLeader: formData.fullName,
          role: selectedType,
        };
        break;
      case "mentor":
      case "community_moderator":
        createData = {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          mentorId: finalMentorId,
          mentorName: formData.fullName,
          teamLeader: formData.teamLeader,
          role: selectedType,
        };
        break;
      default:
        setIsSubmitting(false);
        return;
    }

    const response = await onSubmit(createData);
    
    setIsSubmitting(false);
    
    if (response.success) {
      resetForm();
      onOpenChange(false);
    }
  };

  const handleTypeSelect = (type: UserType) => {
    setSelectedType(type);
    setStep(2);
    setErrors({});
  };

  const handleBack = () => {
    setStep(1);
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) resetForm();
      onOpenChange(value);
    }}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 2 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 mr-1"
                onClick={handleBack}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {step === 1 ? "Select User Type" : `Create ${userTypes.find(t => t.value === selectedType)?.label}`}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose the type of user you want to create:
            </p>
            {userTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleTypeSelect(type.value)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left",
                  "hover:border-primary hover:bg-primary/5",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-lg",
                  type.value === "admin" && "bg-destructive/10 text-destructive",
                  type.value === "team_leader" && "bg-secondary/10 text-secondary",
                  type.value === "mentor" && "bg-primary/10 text-primary",
                  type.value === "community_moderator" && "bg-purple-100 text-purple-700"
                )}>
                  {type.icon}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{type.label}</p>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Common Fields */}
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            {/* Team Leader specific fields */}
            {selectedType === "team_leader" && (
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name *</Label>
                <Input
                  id="teamName"
                  placeholder="e.g., Engineering Team"
                  value={formData.teamName}
                  onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                  className={errors.teamName ? "border-destructive" : ""}
                />
                {errors.teamName && <p className="text-xs text-destructive">{errors.teamName}</p>}
                <p className="text-xs text-muted-foreground">
                  This will be used as the team identifier for mentors.
                </p>
              </div>
            )}

            {/* Mentor / Community Moderator specific fields */}
            {(selectedType === "mentor" || selectedType === "community_moderator") && (
              <div className="space-y-2">
                <Label htmlFor="teamLeader">Assigned Team Leader *</Label>
                <Select
                  value={formData.teamLeader}
                  onValueChange={(value) => setFormData({ ...formData, teamLeader: value })}
                >
                  <SelectTrigger className={errors.teamLeader ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select a team leader" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamLeaders.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No team leaders available
                      </SelectItem>
                    ) : (
                      teamLeaders.map((tl) => (
                        <SelectItem key={tl} value={tl}>
                          {tl}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.teamLeader && <p className="text-xs text-destructive">{errors.teamLeader}</p>}
                {selectedTeamLeaderTeam && (
                  <p className="text-xs text-muted-foreground">
                    Will be assigned to team: <span className="font-medium">{selectedTeamLeaderTeam}</span>
                  </p>
                )}
              </div>
            )}

            {/* Custom User ID Field */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="useCustomMentorId" className="text-sm font-medium">Custom User ID</Label>
                  <p className="text-xs text-muted-foreground">
                    Manually set a unique User ID instead of auto-generating
                  </p>
                </div>
                <Switch
                  id="useCustomMentorId"
                  checked={formData.useCustomMentorId}
                  onCheckedChange={(checked) => {
                    setFormData({ ...formData, useCustomMentorId: checked, mentorId: "" });
                    setMentorIdError("");
                  }}
                />
              </div>
              
              {formData.useCustomMentorId && (
                <div className="space-y-2">
                  <Label htmlFor="mentorId">User ID *</Label>
                  <Input
                    id="mentorId"
                    placeholder="e.g., U-12345 or STAFF-001"
                    value={formData.mentorId}
                    onChange={(e) => {
                      setFormData({ ...formData, mentorId: e.target.value });
                      setMentorIdError("");
                    }}
                    className={mentorIdError ? "border-destructive" : ""}
                  />
                  {mentorIdError && <p className="text-xs text-destructive">{mentorIdError}</p>}
                  <p className="text-xs text-muted-foreground">
                    Must be unique across all users. This ID will be visible in profiles and tasks.
                  </p>
                </div>
              )}
            </div>

            {/* Info boxes */}
            {selectedType === "admin" && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive font-medium">⚠️ Admin Access</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This user will have full system access including user management, all tasks, and system settings.
                </p>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
