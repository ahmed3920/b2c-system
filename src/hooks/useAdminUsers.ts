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
  newPassword?: string;
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

  const deleteUser = async (userId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("admin-delete-user", {
        body: { userId },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to delete user");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: "User deleted",
        description: "Successfully deleted user",
      });

      await fetchUsers();
      return { success: true };
    } catch (error: any) {
      toast({
        title: "Error deleting user",
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
    deleteUser,
  };
}
