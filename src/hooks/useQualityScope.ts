import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { normalizeTeamLeaderName } from "@/lib/teamLeaders";

export type QualityScope = {
  /** Force the team-leader filter to this name (team leaders). */
  lockedTeamLead: string | null;
  /** Force the mentor filter to this name (mentors / moderators). */
  lockedMentor: string | null;
  loading: boolean;
};

/**
 * Restricts Quality data to what the signed-in person is allowed to see:
 * admins see everything, team leaders see their own team, mentors see only
 * the tutors they mentor.
 */
export function useQualityScope(): QualityScope {
  const { isAdmin, isTeamLeader, isLoading: roleLoading } = useUserRole();
  const [name, setName] = useState<string | null>(null);
  const [nameLoading, setNameLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (active) { setName(null); setNameLoading(false); }
          return;
        }
        const { data } = await supabase
          .from("profiles")
          .select("mentor_name, full_name")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (active) {
          setName(data?.mentor_name || data?.full_name || null);
          setNameLoading(false);
        }
      } catch {
        if (active) setNameLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const loading = roleLoading || nameLoading;
  if (loading || isAdmin) {
    return { lockedTeamLead: null, lockedMentor: null, loading, displayName: null };
  }
  // The replica may store a shorter form of the name ("Ahmed Hesham" vs
  // "Ahmed Hesham Helmy"), so match on the first two name parts.
  const shortName = (v: string | null) => {
    const parts = (v ?? "").replace(/\s+/g, " ").trim().split(" ");
    return parts.filter(Boolean).slice(0, 2).join(" ");
  };
  if (isTeamLeader) {
    const full = normalizeTeamLeaderName(name) ?? name ?? "";
    return {
      lockedTeamLead: shortName(full) || "__none__",
      lockedMentor: null,
      loading: false,
      displayName: full || null,
    };
  }
  return {
    lockedTeamLead: null,
    lockedMentor: shortName(name) || "__none__",
    loading: false,
    displayName: name,
  };
}
