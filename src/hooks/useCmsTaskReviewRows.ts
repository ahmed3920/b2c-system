import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CmsReviewTab } from "./useCmsReviewOptions";

export interface CmsTaskReviewRow {
  id: string;
  task_id: string;
  tab: CmsReviewTab;
  attempt: number;
  note: string;
  category_id: string | null;
  status_id: string | null;
  impact_id: string | null;
  deliverable_url: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function useCmsTaskReviewRows(taskId: string | null) {
  const [rows, setRows] = useState<CmsTaskReviewRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) { setRows([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("cms_task_review_rows" as never)
      .select("*")
      .eq("task_id", taskId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    setRows(((data as unknown) as CmsTaskReviewRow[]) ?? []);
    setLoading(false);
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (tab: CmsReviewTab) => {
    if (!taskId) return { ok: false as const, error: "No task" };
    const { data: { session } } = await supabase.auth.getSession();
    const nextOrder = (rows.filter((r) => r.tab === tab).at(-1)?.display_order ?? 0) + 1;
    const { error } = await supabase.from("cms_task_review_rows" as never).insert({
      task_id: taskId,
      tab,
      attempt: 1,
      note: "",
      display_order: nextOrder,
      created_by: session?.user.id,
    } as never);
    if (error) return { ok: false as const, error: error.message };
    await load();
    return { ok: true as const };
  }, [taskId, rows, load]);

  const update = useCallback(async (id: string, patch: Partial<CmsTaskReviewRow>) => {
    // optimistic
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } as CmsTaskReviewRow : r)));
    const { error } = await supabase
      .from("cms_task_review_rows" as never)
      .update(patch as never)
      .eq("id", id);
    if (error) { await load(); return { ok: false as const, error: error.message }; }
    return { ok: true as const };
  }, [load]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("cms_task_review_rows" as never).delete().eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    setRows((rs) => rs.filter((r) => r.id !== id));
    return { ok: true as const };
  }, []);

  return { rows, loading, refresh: load, add, update, remove };
}
