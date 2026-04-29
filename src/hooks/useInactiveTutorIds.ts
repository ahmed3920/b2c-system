import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a Set of tutor_external_id values whose status is 'resigned' or 'terminated'.
 * Use this to filter inactive tutors out of any roster/list across the app.
 *
 * Auto-refreshes via realtime subscription on the tutor_status table.
 */
export function useInactiveTutorIds() {
  const [inactiveIds, setInactiveIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchInactive = async () => {
      const { data } = await supabase
        .from("tutor_status")
        .select("tutor_external_id, status")
        .neq("status", "active");
      if (!mounted) return;
      const ids = new Set<string>();
      for (const r of data ?? []) {
        if (r.tutor_external_id) ids.add(r.tutor_external_id);
      }
      setInactiveIds(ids);
      setIsLoading(false);
    };

    fetchInactive();

    const channel = supabase
      .channel("inactive_tutor_ids_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tutor_status" },
        () => fetchInactive(),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { inactiveIds, isLoading };
}
