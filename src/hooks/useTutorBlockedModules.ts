import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BlockedModuleRow {
  id: string;
  tutor_external_id: string;
  module_id: string;
  reason: string | null;
  team_leader: string | null;
}

/**
 * All blocked module rows visible to the current user (paginated to bypass
 * the 1000-row default limit).
 */
export const useTutorBlockedModules = () =>
  useQuery({
    queryKey: ["tutor-blocked-modules"],
    queryFn: async (): Promise<BlockedModuleRow[]> => {
      const PAGE = 1000;
      let from = 0;
      const all: BlockedModuleRow[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("tutor_blocked_modules")
          .select("id, tutor_external_id, module_id, reason, team_leader")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = (data ?? []) as BlockedModuleRow[];
        all.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });

export const useBlockModule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tutor_external_id: string;
      module_id: string;
      team_leader?: string | null;
      reason?: string;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id ?? null;
      let displayName: string | null = null;
      if (userId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, mentor_name")
          .eq("user_id", userId)
          .maybeSingle();
        displayName = prof?.full_name ?? prof?.mentor_name ?? null;
      }
      const { error } = await supabase.from("tutor_blocked_modules").insert({
        tutor_external_id: input.tutor_external_id,
        module_id: input.module_id,
        team_leader: input.team_leader ?? null,
        reason: input.reason ?? "Device Limitation",
        blocked_by: userId,
        blocked_by_name: displayName,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tutor-blocked-modules"] }),
  });
};

export const useUnblockModule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tutor_external_id: string; module_id: string }) => {
      const { error } = await supabase
        .from("tutor_blocked_modules")
        .delete()
        .eq("tutor_external_id", input.tutor_external_id)
        .eq("module_id", input.module_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tutor-blocked-modules"] }),
  });
};
