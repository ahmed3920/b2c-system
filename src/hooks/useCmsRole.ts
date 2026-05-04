import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CmsRole = "cms_admin" | "cms_supervisor" | "cms_member";

export function useCmsRole() {
  const [role, setRole] = useState<CmsRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) {
          setRole(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("cms_user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      if (cancelled) return;
      const roles = (data ?? []).map((r) => r.role as CmsRole);
      if (roles.includes("cms_admin")) setRole("cms_admin");
      else if (roles.includes("cms_supervisor")) setRole("cms_supervisor");
      else if (roles.includes("cms_member")) setRole("cms_member");
      else setRole(null);
      setLoading(false);
    };
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    loading,
    isCmsAdmin: role === "cms_admin",
    isCmsSupervisor: role === "cms_supervisor",
    isCmsMember: role === "cms_member",
  };
}
