import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CmsReviewTab = "need_to_improve" | "positive_comments" | "design";
export type CmsReviewOptionKind = "category" | "status" | "impact";

export const REVIEW_TABS: { value: CmsReviewTab; label: string }[] = [
  { value: "need_to_improve", label: "Need to Improve" },
  { value: "positive_comments", label: "Positive Comments" },
  { value: "design", label: "Design" },
];

export interface CmsReviewOption {
  id: string;
  tab: CmsReviewTab;
  kind: CmsReviewOptionKind;
  label: string;
  color: string;
  display_order: number;
  is_active: boolean;
}

export function useCmsReviewOptions() {
  const [options, setOptions] = useState<CmsReviewOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cms_review_options" as never)
      .select("*")
      .order("display_order", { ascending: true });
    setOptions(((data as unknown) as CmsReviewOption[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (input: Omit<CmsReviewOption, "id">) => {
    const { error } = await supabase.from("cms_review_options" as never).insert(input as never);
    if (error) return { ok: false as const, error: error.message };
    await load();
    return { ok: true as const };
  }, [load]);

  const update = useCallback(async (id: string, patch: Partial<CmsReviewOption>) => {
    const { error } = await supabase.from("cms_review_options" as never).update(patch as never).eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    await load();
    return { ok: true as const };
  }, [load]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("cms_review_options" as never).delete().eq("id", id);
    if (error) return { ok: false as const, error: error.message };
    await load();
    return { ok: true as const };
  }, [load]);

  const forTab = useCallback(
    (tab: CmsReviewTab, kind: CmsReviewOptionKind) =>
      options.filter((o) => o.tab === tab && o.kind === kind && o.is_active),
    [options],
  );

  return { options, loading, refresh: load, create, update, remove, forTab };
}
