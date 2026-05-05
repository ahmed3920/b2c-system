import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CmsJobTitle } from "@/lib/cmsJobTitles";

export type CmsRole = "cms_admin" | "cms_supervisor" | "cms_member";

export function useCmsRole() {
  const [role, setRole] = useState<CmsRole | null>(null);
  const [title, setTitle] = useState<CmsJobTitle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) {
          setRole(null);
          setTitle(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("cms_user_roles")
        .select("role, title")
        .eq("user_id", session.user.id);
      if (cancelled) return;
      const rows = (data ?? []) as { role: CmsRole; title: string | null }[];
      const roles = rows.map((r) => r.role);
      let chosen: CmsRole | null = null;
      if (roles.includes("cms_admin")) chosen = "cms_admin";
      else if (roles.includes("cms_supervisor")) chosen = "cms_supervisor";
      else if (roles.includes("cms_member")) chosen = "cms_member";
      setRole(chosen);
      const titleRow = rows.find((r) => r.role === chosen);
      setTitle((titleRow?.title ?? null) as CmsJobTitle | null);
      setLoading(false);
    };
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setRole(null);
        setTitle(null);
        setLoading(false);
        return;
      }
      // Defer to avoid deadlocking the Supabase auth client
      setTimeout(() => { if (!cancelled) load(); }, 0);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    title,
    loading,
    isCmsAdmin: role === "cms_admin",
    isCmsSupervisor: role === "cms_supervisor",
    isCmsMember: role === "cms_member",
  };
}
