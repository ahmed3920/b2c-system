import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EduDescriptionType = "deduction" | "no_deduction" | "neutral";

export interface EduDescription {
  id: string;
  name: string;
  type: EduDescriptionType;
  color: string;
  is_active: boolean;
  display_order: number;
}

export function useEduDescriptions(includeInactive = false) {
  const [items, setItems] = useState<EduDescription[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("edu_descriptions").select("*").order("display_order").order("name");
    if (!includeInactive) q = q.eq("is_active", true);
    const { data, error } = await q;
    if (!error) setItems((data ?? []) as EduDescription[]);
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => { reload(); }, [reload]);

  return { items, loading, reload };
}
