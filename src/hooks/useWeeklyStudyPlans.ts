import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInactiveTutorIds } from "@/hooks/useInactiveTutorIds";

export interface PlanItem {
  id: string;
  module_id: string;
  planned_hours: number;
  is_partial: boolean;
  is_completed: boolean;
  display_order: number;
  module?: {
    grade_band: string;
    module_code: string;
    hours_required: number;
  };
}

export interface WeeklyPlan {
  id: string;
  tutor_external_id: string;
  tutor_name: string;
  team_leader: string;
  week_start: string;
  free_hours: number;
  planned_hours: number;
  status: string;
  notes: string | null;
  items?: PlanItem[];
}

export const useWeeklyStudyPlans = (weekStart: string | null) => {
  const { inactiveIds } = useInactiveTutorIds();
  return useQuery({
    queryKey: ["weekly-study-plans", weekStart, Array.from(inactiveIds).sort().join(",")],
    enabled: !!weekStart,
    queryFn: async (): Promise<WeeklyPlan[]> => {
      const { data: plans, error } = await supabase
        .from("weekly_study_plans")
        .select("*")
        .eq("week_start", weekStart!)
        .order("tutor_name");
      if (error) throw error;
      if (!plans || plans.length === 0) return [];

      const ids = plans.map((p) => p.id);
      const { data: items } = await supabase
        .from("weekly_study_plan_items")
        .select(
          "id, plan_id, module_id, planned_hours, is_partial, is_completed, display_order, study_modules(grade_band, module_code, hours_required)",
        )
        .in("plan_id", ids)
        .order("display_order");

      const byPlan = new Map<string, PlanItem[]>();
      for (const it of (items ?? []) as any[]) {
        const arr = byPlan.get(it.plan_id) ?? [];
        arr.push({
          id: it.id,
          module_id: it.module_id,
          planned_hours: Number(it.planned_hours),
          is_partial: it.is_partial,
          is_completed: it.is_completed,
          display_order: it.display_order,
          module: it.study_modules
            ? {
                grade_band: it.study_modules.grade_band,
                module_code: it.study_modules.module_code,
                hours_required: Number(it.study_modules.hours_required),
              }
            : undefined,
        });
        byPlan.set(it.plan_id, arr);
      }

      return plans.map((p) => ({
        ...(p as any),
        free_hours: Number(p.free_hours),
        planned_hours: Number(p.planned_hours),
        items: byPlan.get(p.id) ?? [],
      }));
    },
  });
};
