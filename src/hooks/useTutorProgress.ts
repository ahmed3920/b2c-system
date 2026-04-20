import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TutorProgressRow {
  tutor_external_id: string;
  tutor_name: string;
  team_leader: string;
  finished_count: number;
  remaining_count: number;
  total_modules: number;
  remaining_modules: { grade_band: string; module_code: string }[];
}

export const useTutorProgress = (weekStart: string | null) => {
  return useQuery({
    queryKey: ["tutor-progress", weekStart],
    enabled: !!weekStart,
    queryFn: async (): Promise<TutorProgressRow[]> => {
      // 1) All active modules (the catalog)
      const { data: modules, error: modErr } = await supabase
        .from("study_modules")
        .select("id, grade_band, module_code, display_order")
        .eq("is_active", true)
        .order("display_order");
      if (modErr) throw modErr;
      const allModules = modules ?? [];
      const moduleById = new Map(allModules.map((m) => [m.id, m]));

      // 2) Tutors in the upcoming-sessions sync for that week
      const { data: occupation, error: occErr } = await supabase
        .from("tutor_weekly_occupation")
        .select("tutor_external_id, tutor_name, team_leader")
        .eq("week_start", weekStart!)
        .eq("phase", "pre")
        .order("tutor_name");
      if (occErr) throw occErr;

      // 3) Finished modules per tutor for that week — paginate to bypass the 1000-row default cap
      const PAGE = 1000;
      let from = 0;
      const published: { tutor_external_id: string; module_id: string }[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("tutor_published_modules")
          .select("tutor_external_id, module_id")
          .eq("week_start", weekStart!)
          .eq("phase", "pre")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = data ?? [];
        published.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
      }

      const finishedByTutor = new Map<string, Set<string>>();
      for (const r of published) {
        if (!finishedByTutor.has(r.tutor_external_id))
          finishedByTutor.set(r.tutor_external_id, new Set());
        finishedByTutor.get(r.tutor_external_id)!.add(r.module_id);
      }

      const rows: TutorProgressRow[] = (occupation ?? []).map((t) => {
        const finished = finishedByTutor.get(t.tutor_external_id) ?? new Set();
        const remaining = allModules.filter((m) => !finished.has(m.id));
        return {
          tutor_external_id: t.tutor_external_id,
          tutor_name: t.tutor_name,
          team_leader: t.team_leader,
          finished_count: finished.size,
          remaining_count: remaining.length,
          total_modules: allModules.length,
          remaining_modules: remaining.map((m) => ({
            grade_band: m.grade_band,
            module_code: m.module_code,
          })),
        };
      });

      return rows;
    },
  });
};
