import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface IncidentCategory {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

export function useSessionIncidentCategories(includeInactive = false) {
  const [items, setItems] = useState<IncidentCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("session_incident_categories")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    const rows = (data as IncidentCategory[]) ?? [];
    setItems(includeInactive ? rows : rows.filter((r) => r.is_active));
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => { reload(); }, [reload]);

  return { items, loading, reload };
}

export interface IncidentFieldConfig {
  id: string;
  field_name: string;
  field_label: string;
  is_required: boolean;
  is_visible: boolean;
  is_locked: boolean;
  display_order: number;
}

export function useIncidentFieldConfig() {
  const [items, setItems] = useState<IncidentFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("session_incident_field_config")
      .select("*")
      .order("display_order", { ascending: true });
    setItems((data as IncidentFieldConfig[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const byName = (name: string) => items.find((f) => f.field_name === name);

  return { items, loading, reload, byName };
}
