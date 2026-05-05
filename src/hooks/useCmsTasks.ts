import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CmsTaskStatus = "todo" | "in_progress" | "done" | "archived";
export type CmsTaskPriority = "low" | "medium" | "high";

export interface CmsTask {
  id: string;
  title: string;
  description: string | null;
  status: CmsTaskStatus;
  priority: CmsTaskPriority;
  date_from: string | null;
  date_to: string | null;
  assignee_id: string | null;
  category_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CmsTaskInput {
  title: string;
  description?: string | null;
  status?: CmsTaskStatus;
  priority?: CmsTaskPriority;
  date_from?: string | null;
  date_to?: string | null;
  assignee_id?: string | null;
  category_id?: string | null;
}

export function useCmsTasks() {
  const [tasks, setTasks] = useState<CmsTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cms_tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setTasks((data as CmsTask[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (input: CmsTaskInput) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false as const, error: "Not signed in" };
    const { data, error } = await supabase
      .from("cms_tasks")
      .insert({ ...input, created_by: session.user.id })
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };
    setTasks((t) => [data as CmsTask, ...t]);
    return { ok: true as const, task: data as CmsTask };
  }, []);

  const update = useCallback(async (id: string, patch: Partial<CmsTaskInput>) => {
    const { data, error } = await supabase
      .from("cms_tasks")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };
    setTasks((t) => t.map((x) => (x.id === id ? (data as CmsTask) : x)));
    return { ok: true as const };
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("cms_tasks").delete().eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    setTasks((t) => t.filter((x) => x.id !== id));
    return { ok: true as const };
  }, []);

  return { tasks, loading, refresh: load, create, update, remove };
}
