import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type TutorStatusValue = "active" | "resigned" | "terminated";

export interface TutorStatusRecord {
  id: string;
  tutor_external_id: string;
  tutor_name: string;
  team_leader: string | null;
  is_mentor: boolean;
  status: TutorStatusValue;
  effective_date: string | null;
  notes: string | null;
  set_by: string | null;
  set_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertTutorStatusInput {
  tutor_external_id: string;
  tutor_name: string;
  team_leader?: string | null;
  is_mentor?: boolean;
  status: TutorStatusValue;
  effective_date?: string | null;
  notes?: string | null;
}

export function useTutorStatus() {
  const [records, setRecords] = useState<TutorStatusRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("tutor_status")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load tutor status", description: error.message, variant: "destructive" });
    } else {
      setRecords((data ?? []) as TutorStatusRecord[]);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("tutor_status_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tutor_status" }, () => {
        fetchAll();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const byTutorId = useMemo(() => {
    const m = new Map<string, TutorStatusRecord>();
    for (const r of records) m.set(r.tutor_external_id, r);
    return m;
  }, [records]);

  const upsertStatus = useCallback(
    async (input: UpsertTutorStatusInput) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;
      let setByName: string | null = null;
      if (userId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, mentor_name")
          .eq("user_id", userId)
          .maybeSingle();
        setByName = prof?.full_name ?? prof?.mentor_name ?? null;
      }

      const payload = {
        tutor_external_id: input.tutor_external_id,
        tutor_name: input.tutor_name,
        team_leader: input.team_leader ?? null,
        is_mentor: input.is_mentor ?? false,
        status: input.status,
        effective_date: input.effective_date ?? null,
        notes: input.notes ?? null,
        set_by: userId,
        set_by_name: setByName,
      };

      const { error } = await supabase
        .from("tutor_status")
        .upsert(payload, { onConflict: "tutor_external_id" });

      if (error) {
        toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
        return { success: false };
      }
      toast({ title: "Status updated", description: `${input.tutor_name} marked as ${input.status}.` });
      await fetchAll();
      return { success: true };
    },
    [fetchAll, toast],
  );

  return { records, byTutorId, isLoading, upsertStatus, refresh: fetchAll };
}
