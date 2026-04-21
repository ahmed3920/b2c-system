import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CSTicketCaseType } from "./csTicketCategories";

export interface CSTicketCategory {
  id: string;
  case_type: CSTicketCaseType;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCSTicketCategories(includeInactive = false) {
  const [items, setItems] = useState<CSTicketCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cs_ticket_categories")
      .select("*")
      .order("case_type", { ascending: true })
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    if (!error && data) {
      const rows = data as unknown as CSTicketCategory[];
      setItems(includeInactive ? rows : rows.filter((r) => r.is_active));
    }
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => {
    reload();
  }, [reload]);

  const byType = useMemo(() => {
    const map: Record<CSTicketCaseType, CSTicketCategory[]> = { CS: [], Edu: [] };
    for (const c of items) map[c.case_type].push(c);
    return map;
  }, [items]);

  return { items, byType, loading, reload };
}
