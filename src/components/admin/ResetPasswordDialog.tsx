import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Eye, EyeOff, KeyRound, Mail, AlertTriangle } from "lucide-react";
import type { UserWithRole } from "@/hooks/useAdminUsers";

type ResetMethod = "manual" | "email";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithRole | null;
  onResetPassword: (userId: string, newPassword?: string) => Promise<{ success: boolean }>;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
  onResetPassword,
}: ResetPasswordDialogProps) {
  const [method, setMethod] = useState<ResetMethod>("manual");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setMethod("manual");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (method === "manual") {
      if (!newPassword) {
        newErrors.password = "Password is required";
      } else if (newPassword.length < 6) {
        newErrors.password = "Password must be at least 6 characters";
      }

      if (newPassword !== confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validateForm()) return;

    setIsSubmitting(true);

    const response = await onResetPassword(
      user.user_id,
      method === "manual" ? newPassword : undefined
    );

    setIsSubmitting(false);

    if (response.success) {
      resetForm();
      onOpenChange(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) resetForm();
      onOpenChange(value);
    }}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            Reset password for <span className="font-semibold">{user.full_name || user.mentor_name}</span> ({user.email})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <RadioGroup
            value={method}
            onValueChange={(value: ResetMethod) => {
              setMethod(value);
              setErrors({});
            }}
            className="space-y-3"
          >
            <div
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                method === "manual" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
              }`}
              onClick={() => setMethod("manual")}
            >
              <RadioGroupItem value="manual" id="manual" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="manual" className="font-medium cursor-pointer flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Set Temporary Password
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Set a new password manually. User will be prompted to change it on first login.
                </p>
              </div>
            </div>

            <div
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                method === "email" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
              }`}
              onClick={() => setMethod("email")}
            >
              <RadioGroupItem value="email" id="email" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="email" className="font-medium cursor-pointer flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Send Reset Email
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Send a password reset link to the user's email address.
                </p>
              </div>
            </div>
          </RadioGroup>

          {method === "manual" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password *</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={errors.confirmPassword ? "border-destructive" : ""}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">{errors.confirmPassword}</p>
                )}
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Share this password securely
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The user will need to change their password after first login.
                  </p>
                </div>
              </div>
            </div>
          )}

          {method === "email" && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm">
                A password reset link will be sent to:{" "}
                <span className="font-medium">{user.email}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                The link will expire in 24 hours. Make sure the email address is correct.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {method === "manual" ? "Set Password" : "Send Reset Email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
