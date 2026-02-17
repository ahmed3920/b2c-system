import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AppRole } from "@/hooks/useUserRole";

export interface UserWithRole {
  user_id: string;
  mentor_id: string;
  mentor_name: string;
  full_name: string | null;
  email: string | null;
  team_leader: string;
  active_status: boolean | null;
  last_login: string | null;
  created_at: string;
  role: AppRole;
}

export interface CreateUserData {
  email: string;
  password: string;
  fullName: string;
  mentorId: string;
  mentorName: string;
  teamLeader: string;
  role: AppRole;
}

export interface UpdateUserData {
  userId: string;
  profileUpdates?: {
    full_name?: string;
    mentor_name?: string;
    team_leader?: string;
    active_status?: boolean;
  };
  newRole?: AppRole;
}

export interface ResetPasswordData {
  userId: string;
  newPassword?: string; // If undefined, send reset email instead
}

export function useAdminUsers() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [teamLeaders, setTeamLeaders] = useState<string[]>([]);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles with roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Create a role map
      const roleMap = new Map<string, AppRole>();
      roles?.forEach((r) => {
        roleMap.set(r.user_id, r.role as AppRole);
      });

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => ({
        user_id: profile.user_id,
        mentor_id: profile.mentor_id,
        mentor_name: profile.mentor_name,
        full_name: profile.full_name,
        email: profile.email,
        team_leader: profile.team_leader,
        active_status: profile.active_status,
        last_login: profile.last_login,
        created_at: profile.created_at,
        role: roleMap.get(profile.user_id) || "mentor",
      }));

      setUsers(usersWithRoles);

      // Extract unique team leaders
      const uniqueTeamLeaders = [...new Set(profiles?.map((p) => p.team_leader) || [])];
      setTeamLeaders(uniqueTeamLeaders);
    } catch (error: any) {
      toast({
        title: "Error fetching users",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createUser = async (data: CreateUserData) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("admin-create-user", {
        body: data,
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create user");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: "User created",
        description: `Successfully created user ${data.email}`,
      });

      await fetchUsers();
      return { success: true };
    } catch (error: any) {
      toast({
        title: "Error creating user",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  const updateUser = async (data: UpdateUserData) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("admin-update-user", {
        body: data,
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to update user");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: "User updated",
        description: "Successfully updated user information",
      });

      await fetchUsers();
      return { success: true };
    } catch (error: any) {
      toast({
        title: "Error updating user",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  const deactivateUser = async (userId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId,
          profileUpdates: { active_status: false },
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to deactivate user");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: "User deactivated",
        description: "User has been deactivated and archived successfully.",
      });

      await fetchUsers();
      return { success: true };
    } catch (error: any) {
      toast({
        title: "Error deactivating user",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  const reactivateUser = async (userId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId,
          profileUpdates: { active_status: true },
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to reactivate user");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: "User reactivated",
        description: "User has been restored to active status.",
      });

      await fetchUsers();
      return { success: true };
    } catch (error: any) {
      toast({
        title: "Error reactivating user",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  const resetPassword = async (data: ResetPasswordData) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("admin-update-user", {
        body: {
          userId: data.userId,
          newPassword: data.newPassword,
          sendResetEmail: !data.newPassword, // If no password provided, send email
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to reset password");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: data.newPassword ? "Password reset" : "Reset email sent",
        description: data.newPassword
          ? "Password has been updated successfully"
          : "Password reset email has been sent to the user",
      });

      return { success: true };
    } catch (error: any) {
      toast({
        title: "Error resetting password",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    isLoading,
    teamLeaders,
    fetchUsers,
    createUser,
    updateUser,
    deactivateUser,
    reactivateUser,
    resetPassword,
  };
}
