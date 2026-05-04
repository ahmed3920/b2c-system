import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SystemKind = "b2c" | "cms";

export function useSystem() {
  const [system, setSystem] = useState<SystemKind | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) {
          setSystem(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("user_systems")
        .select("system")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!cancelled) {
        setSystem(((data?.system as SystemKind) ?? "b2c"));
        setLoading(false);
      }
    };
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { system, loading };
}
