import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true if the current user has been granted full CS Tickets access
 * (view all teams + create) via `cs_ticket_full_access` table.
 */
export function useCsFullAccess() {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        if (!cancelled) {
          setHasAccess(false);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("cs_ticket_full_access")
        .select("user_id")
        .eq("user_id", uid)
        .maybeSingle();
      if (!cancelled) {
        setHasAccess(!!data);
        setLoading(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return { hasAccess, loading };
}
