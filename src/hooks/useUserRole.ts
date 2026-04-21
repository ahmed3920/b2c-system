import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "team_leader" | "super_team_leader" | "mentor" | "community_moderator";

interface UserRoleData {
  role: AppRole | null;
  roles: AppRole[];
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  isTeamLeader: boolean;
  isSuperTeamLeader: boolean;
  isMentor: boolean;
  isCommunityModerator: boolean;
}

export const useUserRole = (): UserRoleData => {
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setRole(null);
          setRoles([]);
          setIsLoading(false);
          return;
        }

        const { data, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: true });

        if (roleError) {
          setError(roleError.message);
        } else if (!data || data.length === 0) {
          setRole("mentor");
          setRoles(["mentor"]);
        } else {
          const all = data.map((r) => r.role as AppRole);
          setRoles(all);
          if (all.includes("admin")) setRole("admin");
          else if (all.includes("super_team_leader")) setRole("super_team_leader");
          else if (all.includes("team_leader")) setRole("team_leader");
          else if (all.includes("community_moderator")) setRole("community_moderator");
          else setRole("mentor");
        }
      } catch (err) {
        setError("Failed to fetch user role");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  // super_team_leader implies team_leader privileges in the UI
  const isSuperTeamLeader = roles.includes("super_team_leader") || role === "super_team_leader";
  const isTeamLeader = role === "team_leader" || isSuperTeamLeader;

  return {
    role,
    roles,
    isLoading,
    error,
    isAdmin: role === "admin",
    isTeamLeader,
    isSuperTeamLeader,
    isMentor: role === "mentor" || role === "community_moderator" || role === null,
    isCommunityModerator: role === "community_moderator",
  };
};
