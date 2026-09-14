import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export type ProjectAuditAccessRow = {
  id: string;
  user_id: string;
  created_at: string;
};

/** Admins always have access; everyone else must be on the allow-list. */
export function useProjectAuditAccess() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) {
      setGranted(false);
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any)
      .from("project_audit_access")
      .select("id")
      .eq("user_id", uid)
      .maybeSingle();
    setGranted(!!data);
    setLoading(false);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return {
    allowed: isAdmin || granted,
    isAdmin,
    loading: loading || roleLoading,
    refetch: check,
  };
}

/** Admin-only management of the allow-list. */
export function useProjectAuditAccessList(enabled: boolean) {
  const [rows, setRows] = useState<(ProjectAuditAccessRow & { full_name?: string | null; email?: string | null })[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("project_audit_access")
      .select("id, user_id, created_at")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as ProjectAuditAccessRow[];
    let profiles: Record<string, { full_name: string | null; email: string | null }> = {};
    if (list.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", list.map((r) => r.user_id));
      profiles = Object.fromEntries(
        (profs ?? []).map((p) => [p.user_id, { full_name: p.full_name, email: p.email }]),
      );
    }
    setRows(list.map((r) => ({ ...r, ...(profiles[r.user_id] ?? {}) })));
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const grant = useCallback(
    async (userId: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("project_audit_access")
        .insert({ user_id: userId, granted_by: auth?.user?.id ?? null });
      if (error) throw new Error(error.message);
      await load();
    },
    [load],
  );

  const revoke = useCallback(
    async (id: string) => {
      const { error } = await (supabase as any).from("project_audit_access").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await load();
    },
    [load],
  );

  return { rows, loading, grant, revoke, refetch: load };
}
