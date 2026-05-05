import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CmsPropType =
  | "text" | "number" | "select" | "multi_select"
  | "date" | "url" | "person" | "checkbox" | "percent";

export interface CmsPropOption {
  value: string;
  label: string;
  color?: string;
}

export interface CmsPropertyDef {
  id: string;
  key: string;
  label: string;
  type: CmsPropType;
  options: CmsPropOption[];
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CmsPropertyValue {
  id: string;
  task_id: string;
  prop_id: string;
  value: unknown;
  updated_at: string;
}

export function useCmsPropertyDefs() {
  const [defs, setDefs] = useState<CmsPropertyDef[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cms_task_property_defs")
      .select("*")
      .order("display_order", { ascending: true });
    setDefs(((data as unknown) as CmsPropertyDef[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (def: Omit<CmsPropertyDef, "id" | "created_at" | "updated_at">) => {
    const { data, error } = await supabase
      .from("cms_task_property_defs")
      .insert(def as never)
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };
    setDefs((d) => [...d, data as unknown as CmsPropertyDef].sort((a, b) => a.display_order - b.display_order));
    return { ok: true as const };
  }, []);

  const update = useCallback(async (id: string, patch: Partial<CmsPropertyDef>) => {
    const { data, error } = await supabase
      .from("cms_task_property_defs")
      .update(patch as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };
    setDefs((d) => d.map((x) => (x.id === id ? (data as unknown as CmsPropertyDef) : x)));
    return { ok: true as const };
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("cms_task_property_defs").delete().eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    setDefs((d) => d.filter((x) => x.id !== id));
    return { ok: true as const };
  }, []);

  return { defs, loading, refresh: load, create, update, remove };
}

export function useCmsTaskPropertyValues(taskId: string | null) {
  const [values, setValues] = useState<CmsPropertyValue[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) { setValues([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("cms_task_property_values")
      .select("*")
      .eq("task_id", taskId);
    setValues(((data as unknown) as CmsPropertyValue[]) ?? []);
    setLoading(false);
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  const setValue = useCallback(async (prop_id: string, value: unknown) => {
    if (!taskId) return { ok: false as const, error: "No task" };
    const { data: { session } } = await supabase.auth.getSession();
    const existing = values.find((v) => v.prop_id === prop_id);
    if (existing) {
      const { data, error } = await supabase
        .from("cms_task_property_values")
        .update({ value: value as never, updated_by: session?.user.id })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) return { ok: false as const, error: error.message };
      setValues((vs) => vs.map((v) => (v.id === existing.id ? (data as unknown as CmsPropertyValue) : v)));
    } else {
      const { data, error } = await supabase
        .from("cms_task_property_values")
        .insert({ task_id: taskId, prop_id, value: value as never, updated_by: session?.user.id })
        .select("*")
        .single();
      if (error) return { ok: false as const, error: error.message };
      setValues((vs) => [...vs, data as unknown as CmsPropertyValue]);
    }
    return { ok: true as const };
  }, [taskId, values]);

  return { values, loading, refresh: load, setValue };
}
