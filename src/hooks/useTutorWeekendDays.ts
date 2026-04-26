import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TutorWeekendDays {
  tutor_external_id: string;
  weekend_days: string[];
}

/**
 * Loads every tutor's weekend (off) days. Falls back to ['wednesday','thursday']
 * (the Fri→Tue work week default) when a tutor isn't in the table.
 */
export const useTutorWeekendDays = () =>
  useQuery({
    queryKey: ["tutor-weekend-days"],
    queryFn: async (): Promise<Map<string, string[]>> => {
      const PAGE = 1000;
      const map = new Map<string, string[]>();
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("tutor_weekend_days")
          .select("tutor_external_id, weekend_days")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = data ?? [];
        for (const r of batch) {
          map.set(
            r.tutor_external_id,
            (r.weekend_days ?? []).map((d) => String(d).toLowerCase()),
          );
        }
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

export const DEFAULT_WEEKEND_DAYS = ["wednesday", "thursday"];

export const formatWeekendDays = (days: string[] | undefined): string => {
  const list = days && days.length > 0 ? days : DEFAULT_WEEKEND_DAYS;
  return list.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(" / ");
};
