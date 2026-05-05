import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CmsRole } from "@/hooks/useCmsRole";
import { tierForTitle, type CmsJobTitle } from "@/lib/cmsJobTitles";

export interface CmsUser {
  user_id: string;
  full_name: string;
  email: string | null;
  active_status: boolean;
  role: CmsRole | null;
  title: CmsJobTitle | null;
  created_at: string;
}

export function useCmsUsers() {
  const [users, setUsers] = useState<CmsUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("cms_profiles")
      .select("user_id, full_name, email, active_status, created_at")
      .order("created_at", { ascending: false });
    const ids = (profiles ?? []).map((p) => p.user_id);
    let rolesByUser = new Map<string, { role: CmsRole; title: CmsJobTitle | null }>();
    if (ids.length) {
      const { data: roles } = await supabase
        .from("cms_user_roles")
        .select("user_id, role, title")
        .in("user_id", ids);
      rolesByUser = new Map(
        (roles ?? []).map((r) => [
          r.user_id,
          { role: r.role as CmsRole, title: ((r as { title?: string | null }).title ?? null) as CmsJobTitle | null },
        ]),
      );
    }
    setUsers(
      (profiles ?? []).map((p) => {
        const entry = rolesByUser.get(p.user_id);
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          active_status: p.active_status,
          role: entry?.role ?? null,
          title: entry?.title ?? null,
          created_at: p.created_at,
        };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setActive = useCallback(async (user_id: string, active: boolean) => {
    const { error } = await supabase
      .from("cms_profiles")
      .update({ active_status: active })
      .eq("user_id", user_id);
    if (error) return { ok: false as const, error: error.message };
    await load();
    return { ok: true as const };
  }, [load]);

  // Set the user's job title; tier (cms_admin/supervisor/member) is derived from the title.
  const setTitle = useCallback(async (user_id: string, title: CmsJobTitle) => {
    const tier = tierForTitle(title);
    await supabase.from("cms_user_roles").delete().eq("user_id", user_id);
    const { error } = await supabase
      .from("cms_user_roles")
      .insert({ user_id, role: tier, title } as never);
    if (error) return { ok: false as const, error: error.message };
    await load();
    return { ok: true as const };
  }, [load]);

  // Back-compat alias
  const setRole = useCallback(async (user_id: string, role: CmsRole) => {
    await supabase.from("cms_user_roles").delete().eq("user_id", user_id);
    const { error } = await supabase.from("cms_user_roles").insert({ user_id, role });
    if (error) return { ok: false as const, error: error.message };
    await load();
    return { ok: true as const };
  }, [load]);

  return { users, loading, refresh: load, setActive, setRole, setTitle };
}

