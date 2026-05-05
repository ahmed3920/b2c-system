import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CmsTaskCommentStatus = "open" | "resolved" | "needs_review";

export interface CmsTaskComment {
  id: string;
  task_id: string;
  body: string;
  status: CmsTaskCommentStatus;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export function useCmsTaskComments(taskId: string | null) {
  const [comments, setComments] = useState<CmsTaskComment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!taskId) {
      setComments([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("cms_task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    setComments((data as CmsTaskComment[]) ?? []);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (body: string) => {
      if (!taskId || !body.trim()) return { ok: false as const, error: "Empty" };
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { ok: false as const, error: "Not signed in" };
      let name: string | null = null;
      const { data: prof } = await supabase
        .from("cms_profiles")
        .select("full_name")
        .eq("user_id", session.user.id)
        .maybeSingle();
      name = prof?.full_name ?? null;
      const { data, error } = await supabase
        .from("cms_task_comments")
        .insert({
          task_id: taskId,
          body: body.trim(),
          created_by: session.user.id,
          created_by_name: name,
        })
        .select("*")
        .single();
      if (error) return { ok: false as const, error: error.message };
      setComments((c) => [...c, data as CmsTaskComment]);
      return { ok: true as const };
    },
    [taskId],
  );

  const setStatus = useCallback(async (id: string, status: CmsTaskCommentStatus) => {
    const { data, error } = await supabase
      .from("cms_task_comments")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };
    setComments((c) => c.map((x) => (x.id === id ? (data as CmsTaskComment) : x)));
    return { ok: true as const };
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("cms_task_comments").delete().eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    setComments((c) => c.filter((x) => x.id !== id));
    return { ok: true as const };
  }, []);

  return { comments, loading, refresh: load, add, setStatus, remove };
}
