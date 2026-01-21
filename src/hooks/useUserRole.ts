import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "team_leader" | "mentor";

interface UserRoleData {
  role: AppRole | null;
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  isTeamLeader: boolean;
  isMentor: boolean;
}

export const useUserRole = (): UserRoleData => {
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setRole(null);
          setIsLoading(false);
          return;
        }

        const { data, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        if (roleError) {
          // If no role found, default to mentor
          if (roleError.code === "PGRST116") {
            setRole("mentor");
          } else {
            setError(roleError.message);
          }
        } else {
          setRole(data?.role as AppRole || "mentor");
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

  return {
    role,
    isLoading,
    error,
    isAdmin: role === "admin",
    isTeamLeader: role === "team_leader",
    isMentor: role === "mentor" || role === null,
  };
};
