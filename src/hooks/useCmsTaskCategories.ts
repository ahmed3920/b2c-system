import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CmsTaskCategory {
  id: string;
  name: string;
  color: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCmsTaskCategories(includeInactive = false) {
  const [categories, setCategories] = useState<CmsTaskCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("cms_task_categories" as never).select("*").order("display_order");
    if (!includeInactive) q = q.eq("is_active", true);
    const { data } = await q;
    setCategories((data as CmsTaskCategory[]) ?? []);
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (input: Partial<CmsTaskCategory>) => {
    const { data, error } = await supabase
      .from("cms_task_categories" as never)
      .insert(input as never)
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };
    setCategories((c) => [...c, data as CmsTaskCategory].sort((a, b) => a.display_order - b.display_order));
    return { ok: true as const };
  }, []);

  const update = useCallback(async (id: string, patch: Partial<CmsTaskCategory>) => {
    const { error } = await supabase.from("cms_task_categories" as never).update(patch as never).eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    await load();
    return { ok: true as const };
  }, [load]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("cms_task_categories" as never).delete().eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    setCategories((c) => c.filter((x) => x.id !== id));
    return { ok: true as const };
  }, []);

  return { categories, loading, refresh: load, create, update, remove };
}
