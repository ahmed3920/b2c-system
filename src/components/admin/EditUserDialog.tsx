import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Loader2, User, Mail, Users, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/RoleBadge";
import type { UserWithRole, UpdateUserData } from "@/hooks/useAdminUsers";
import type { AppRole } from "@/hooks/useUserRole";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithRole | null;
  onSubmit: (data: UpdateUserData) => Promise<{ success: boolean }>;
  teamLeaders: string[];
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  teamLeaders,
}: EditUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    mentorName: "",
    teamLeader: "",
    activeStatus: true,
    role: "mentor" as AppRole,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.full_name || "",
        mentorName: user.mentor_name,
        teamLeader: user.team_leader,
        activeStatus: user.active_status ?? true,
        role: user.role,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    const updateData: UpdateUserData = {
      userId: user.user_id,
      profileUpdates: {
        full_name: formData.fullName,
        mentor_name: formData.mentorName,
        team_leader: formData.teamLeader,
        active_status: formData.activeStatus,
      },
      newRole: formData.role !== user.role ? formData.role : undefined,
    };

    const response = await onSubmit(updateData);
    
    setIsSubmitting(false);
    
    if (response.success) {
      onOpenChange(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <User className="w-5 h-5" />
            Edit User
          </DialogTitle>
        </DialogHeader>

        {/* User Info Header */}
        <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-lg font-semibold text-primary">
              {(user.full_name || user.mentor_name).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <p className="font-medium">{user.full_name || user.mentor_name}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {user.email}
            </p>
          </div>
          <RoleBadge role={user.role} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">Full Name</Label>
              <Input
                id="edit-fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-mentorName">Display Name</Label>
              <Input
                id="edit-mentorName"
                value={formData.mentorName}
                onChange={(e) => setFormData({ ...formData, mentorName: e.target.value })}
                placeholder="Display name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-teamLeader" className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                Team / Leader
              </Label>
              <Select
                value={formData.teamLeader}
                onValueChange={(value) => setFormData({ ...formData, teamLeader: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team leader" />
                </SelectTrigger>
                <SelectContent>
                  {teamLeaders.map((tl) => (
                    <SelectItem key={tl} value={tl}>
                      {tl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role" className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Role
              </Label>
              {user.role === "admin" ? (
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/50">
                  <span className="text-sm text-muted-foreground">Super Admin</span>
                  <Badge variant="outline" className="text-xs">Protected</Badge>
                </div>
              ) : (
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
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Role change warning */}
          {formData.role !== user.role && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                ⚠️ Role Change
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Changing role from{" "}
                <span className="font-medium">{user.role.replace("_", " ")}</span> to{" "}
                <span className="font-medium">{formData.role.replace("_", " ")}</span> will
                update the user's permissions immediately.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="edit-active" className="font-medium">Account Status</Label>
              <p className="text-sm text-muted-foreground">
                {formData.activeStatus
                  ? "User can access the system"
                  : "User is blocked from accessing the system"}
              </p>
            </div>
            <Switch
              id="edit-active"
              checked={formData.activeStatus}
              onCheckedChange={(checked) => setFormData({ ...formData, activeStatus: checked })}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
