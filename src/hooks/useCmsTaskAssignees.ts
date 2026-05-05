import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CmsAssigneeRole = "developer" | "reviewer" | "senior_developer" | "team_leader";

export interface CmsTaskAssignee {
  id: string;
  task_id: string;
  user_id: string;
  role: CmsAssigneeRole;
  created_at: string;
}

export function useCmsTaskAssignees(taskId: string | null) {
  const [assignees, setAssignees] = useState<CmsTaskAssignee[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) {
      setAssignees([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("cms_task_assignees")
      .select("*")
      .eq("task_id", taskId);
    setAssignees((data as CmsTaskAssignee[]) ?? []);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (user_id: string, role: CmsAssigneeRole) => {
      if (!taskId) return { ok: false as const, error: "No task" };
      const { data, error } = await supabase
        .from("cms_task_assignees")
        .insert({ task_id: taskId, user_id, role })
        .select("*")
        .single();
      if (error) return { ok: false as const, error: error.message };
      setAssignees((a) => [...a, data as CmsTaskAssignee]);
      return { ok: true as const };
    },
    [taskId],
  );

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("cms_task_assignees").delete().eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    setAssignees((a) => a.filter((x) => x.id !== id));
    return { ok: true as const };
  }, []);

  return { assignees, loading, refresh: load, add, remove };
}
