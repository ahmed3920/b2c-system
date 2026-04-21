import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlanSnapshot {
  id: string;
  week_start: string;
  team_leader: string | null;
  tutors_count: number;
  items_count: number;
  total_free_hours: number;
  total_planned_hours: number;
  generated_by_name: string | null;
  notes: string | null;
  created_at: string;
}

export const useStudyPlanSnapshots = () => {
  return useQuery({
    queryKey: ["weekly-study-plan-snapshots"],
    queryFn: async (): Promise<PlanSnapshot[]> => {
      const { data, error } = await supabase
        .from("weekly_study_plan_snapshots")
        .select("*")
        .order("week_start", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlanSnapshot[];
    },
  });
};
