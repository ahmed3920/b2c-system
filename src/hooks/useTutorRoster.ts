import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { tutorRoster, type TutorRecord } from "@/data/tutorRoster";
import { setRosterOverrides } from "@/data/rosterCache";

export interface RosterOverride {
  tutor_external_id: string;
  name: string;
  team_leader: string | null;
  mentor: string | null;
  ranking: string | null;
  phone: string | null;
  role: string | null;
  language: string | null;
  employment_type: string | null;
  is_new: boolean;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_at: string;
}

export type MergedTutor = TutorRecord & { _isNew?: boolean; _hasOverride?: boolean };

/** Returns the roster merged with DB overrides. */
export function useTutorRoster() {
  const [overrides, setOverrides] = useState<RosterOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tutor_roster_overrides")
      .select("*");
    if (error) {
      toast({ title: "Failed to load roster overrides", description: error.message, variant: "destructive" });
    } else {
      const rows = (data ?? []) as RosterOverride[];
      setOverrides(rows);
      setRosterOverrides(rows);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("tutor_roster_overrides_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tutor_roster_overrides" }, () => {
        fetchAll();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const merged: MergedTutor[] = useMemo(() => {
    const byId = new Map<string, MergedTutor>();
    for (const t of tutorRoster) byId.set(t.id, { ...t });
    for (const o of overrides) {
      const existing = byId.get(o.tutor_external_id);
      if (existing) {
        byId.set(o.tutor_external_id, {
          ...existing,
          name: o.name || existing.name,
          team_leader: o.team_leader ?? existing.team_leader,
          mentor: o.mentor ?? existing.mentor,
          ranking: o.ranking ?? existing.ranking,
          phone: o.phone ?? existing.phone,
          role: (o.role ?? existing.role) as TutorRecord["role"],
          language: o.language ?? existing.language,
          employment_type: (o.employment_type ?? existing.employment_type) as TutorRecord["employment_type"],
          _hasOverride: true,
        });
      } else {
        // Override exists for a tutor not in static roster — always include.
        byId.set(o.tutor_external_id, {
          id: o.tutor_external_id,
          name: o.name,
          team_leader: o.team_leader ?? "",
          mentor: o.mentor ?? "",
          ranking: o.ranking ?? "",
          phone: o.phone ?? "",
          role: (o.role ?? "Tutor") as TutorRecord["role"],
          language: o.language ?? "",
          employment_type: (o.employment_type ?? "Full-time") as TutorRecord["employment_type"],
          _isNew: !!o.is_new,
          _hasOverride: true,
        });
      }
    }
    return Array.from(byId.values());
  }, [overrides]);

  const upsertOverride = useCallback(
    async (input: Partial<RosterOverride> & { tutor_external_id: string; name: string; is_new?: boolean }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;
      let userName: string | null = null;
      if (userId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, mentor_name")
          .eq("user_id", userId)
          .maybeSingle();
        userName = prof?.full_name ?? prof?.mentor_name ?? null;
      }
      const payload = {
        ...input,
        is_new: input.is_new ?? false,
        updated_by: userId,
        updated_by_name: userName,
      };
      const { error } = await supabase
        .from("tutor_roster_overrides")
        .upsert(payload, { onConflict: "tutor_external_id" });
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return { success: false };
      }
      await fetchAll();
      return { success: true };
    },
    [fetchAll, toast],
  );

  return { merged, overrides, loading, upsertOverride, refresh: fetchAll };
}
