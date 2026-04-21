import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current logged-in user's `mentor_name` from profiles.
 * For Team Leaders, this value matches `team_leader` on tutors/profiles
 * belonging to their team — use it to scope team-only views.
 */
export function useCurrentTeamLeader() {
  const [teamLeader, setTeamLeader] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (active) {
            setTeamLeader(null);
            setIsLoading(false);
          }
          return;
        }
        const { data } = await supabase
          .from("profiles")
          .select("mentor_name")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (active) {
          setTeamLeader(data?.mentor_name ?? null);
          setIsLoading(false);
        }
      } catch {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { teamLeader, isLoading };
}
