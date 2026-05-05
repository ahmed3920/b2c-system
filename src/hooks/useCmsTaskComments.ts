import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CmsTaskCommentStatus = "open" | "resolved" | "needs_review";

export interface CmsCommentAttachment {
  path: string;
  name: string;
  size: number;
  mime: string;
}

export interface CmsTaskComment {
  id: string;
  task_id: string;
  body: string;
  status: CmsTaskCommentStatus;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  attachments: CmsCommentAttachment[];
}

const BUCKET = "cms-comment-attachments";

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
    setComments(
      ((data ?? []) as unknown as CmsTaskComment[]).map((c) => ({
        ...c,
        attachments: Array.isArray(c.attachments) ? c.attachments : [],
      })),
    );
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadFiles = useCallback(
    async (files: File[]): Promise<CmsCommentAttachment[]> => {
      if (!taskId || files.length === 0) return [];
      const uploaded: CmsCommentAttachment[] = [];
      for (const file of files) {
        const path = `${taskId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (!error) {
          uploaded.push({ path, name: file.name, size: file.size, mime: file.type });
        }
      }
      return uploaded;
    },
    [taskId],
  );

  const getSignedUrl = useCallback(async (path: string) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  }, []);

  const add = useCallback(
    async (body: string, files: File[] = []) => {
      if (!taskId) return { ok: false as const, error: "No task" };
      if (!body.trim() && files.length === 0) return { ok: false as const, error: "Empty" };
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { ok: false as const, error: "Not signed in" };
      const { data: prof } = await supabase
        .from("cms_profiles")
        .select("full_name")
        .eq("user_id", session.user.id)
        .maybeSingle();
      const attachments = await uploadFiles(files);
      const { data, error } = await supabase
        .from("cms_task_comments")
        .insert({
          task_id: taskId,
          body: body.trim(),
          created_by: session.user.id,
          created_by_name: prof?.full_name ?? null,
          attachments: attachments as never,
        })
        .select("*")
        .single();
      if (error) return { ok: false as const, error: error.message };
      setComments((c) => [
        ...c,
        { ...(data as unknown as CmsTaskComment), attachments },
      ]);
      return { ok: true as const };
    },
    [taskId, uploadFiles],
  );

  const setStatus = useCallback(async (id: string, status: CmsTaskCommentStatus) => {
    const { data, error } = await supabase
      .from("cms_task_comments")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };
    setComments((c) =>
      c.map((x) =>
        x.id === id
          ? { ...(data as unknown as CmsTaskComment), attachments: x.attachments }
          : x,
      ),
    );
    return { ok: true as const };
  }, []);

  const remove = useCallback(async (id: string) => {
    const target = comments.find((c) => c.id === id);
    if (target?.attachments?.length) {
      await supabase.storage.from(BUCKET).remove(target.attachments.map((a) => a.path));
    }
    const { error } = await supabase.from("cms_task_comments").delete().eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    setComments((c) => c.filter((x) => x.id !== id));
    return { ok: true as const };
  }, [comments]);

  return { comments, loading, refresh: load, add, setStatus, remove, getSignedUrl };
}
