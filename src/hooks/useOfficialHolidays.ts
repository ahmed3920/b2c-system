import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OfficialHoliday {
  id: string;
  holiday_date: string;
  label: string | null;
}

export const useOfficialHolidays = () =>
  useQuery({
    queryKey: ["official-holidays"],
    queryFn: async (): Promise<OfficialHoliday[]> => {
      const { data, error } = await supabase
        .from("official_holidays")
        .select("id, holiday_date, label")
        .order("holiday_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OfficialHoliday[];
    },
  });

export const useAddOfficialHoliday = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { holiday_date: string; label?: string | null }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("official_holidays").insert({
        holiday_date: input.holiday_date,
        label: input.label ?? null,
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["official-holidays"] }),
  });
};

export const useDeleteOfficialHoliday = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("official_holidays")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["official-holidays"] }),
  });
};
