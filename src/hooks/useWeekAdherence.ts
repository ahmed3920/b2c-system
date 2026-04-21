import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlannedModule {
  module_id: string;
  grade_band: string;
  module_code: string;
  hours_required: number;
  planned_hours: number;
  is_partial: boolean;
  is_finished: boolean; // matched against post-week finished set
}

export type AdherenceStatus = "on_track" | "partial" | "off_plan" | "no_data";

export interface TutorAdherence {
  tutor_external_id: string;
  tutor_name: string;
  team_leader: string;

  planned_modules: PlannedModule[];
  planned_count: number;
  finished_planned_count: number; // planned modules that were finished
  extra_finished_count: number; // finished but not in plan

  planned_hours: number;
  free_hours_pre: number;

  scheduled_sessions_pre: number | null;
  actual_sessions_post: number | null;

  adherence_pct: number; // module-based: finished_planned / planned_count
  status: AdherenceStatus;
  has_post_data: boolean;
}

export interface WeekAdherenceResult {
  tutors: TutorAdherence[];
  has_any_post_modules: boolean;
  has_any_post_sessions: boolean;
}

const PAGE = 1000;

async function fetchAllPublished(weekStart: string, phase: "pre" | "post") {
  const out: { tutor_external_id: string; module_id: string; is_finished: boolean }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("tutor_published_modules")
      .select("tutor_external_id, module_id, is_finished")
      .eq("week_start", weekStart)
      .eq("phase", phase)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export const useWeekAdherence = (weekStart: string | null) => {
  return useQuery({
    queryKey: ["week-adherence", weekStart],
    enabled: !!weekStart,
    queryFn: async (): Promise<WeekAdherenceResult> => {
      // 1. Plans + items for the week
      const { data: plans, error: planErr } = await supabase
        .from("weekly_study_plans")
        .select("id, tutor_external_id, tutor_name, team_leader, free_hours, planned_hours")
        .eq("week_start", weekStart!);
      if (planErr) throw planErr;

      const planIds = (plans ?? []).map((p) => p.id);
      let items: any[] = [];
      if (planIds.length) {
        const { data: itemsData, error: itemsErr } = await supabase
          .from("weekly_study_plan_items")
          .select(
            "plan_id, module_id, planned_hours, is_partial, study_modules(grade_band, module_code, hours_required)",
          )
          .in("plan_id", planIds);
        if (itemsErr) throw itemsErr;
        items = itemsData ?? [];
      }

      // 2. Pre & post occupation (for sessions counts)
      const { data: occPre } = await supabase
        .from("tutor_weekly_occupation")
        .select("tutor_external_id, scheduled_sessions, free_hours")
        .eq("week_start", weekStart!)
        .eq("phase", "pre");
      const { data: occPost } = await supabase
        .from("tutor_weekly_occupation")
        .select("tutor_external_id, scheduled_sessions")
        .eq("week_start", weekStart!)
        .eq("phase", "post");

      // 3. Post-week finished modules (the comparison source)
      const postPublished = await fetchAllPublished(weekStart!, "post");

      const finishedByTutor = new Map<string, Set<string>>();
      for (const r of postPublished) {
        if (!r.is_finished) continue;
        if (!finishedByTutor.has(r.tutor_external_id)) {
          finishedByTutor.set(r.tutor_external_id, new Set());
        }
        finishedByTutor.get(r.tutor_external_id)!.add(r.module_id);
      }

      const preSessionsByTutor = new Map<string, number>();
      for (const o of occPre ?? []) {
        preSessionsByTutor.set(o.tutor_external_id, Number(o.scheduled_sessions ?? 0));
      }
      const postSessionsByTutor = new Map<string, number>();
      for (const o of occPost ?? []) {
        postSessionsByTutor.set(o.tutor_external_id, Number(o.scheduled_sessions ?? 0));
      }

      const itemsByPlan = new Map<string, any[]>();
      for (const it of items) {
        const arr = itemsByPlan.get(it.plan_id) ?? [];
        arr.push(it);
        itemsByPlan.set(it.plan_id, arr);
      }

      const tutors: TutorAdherence[] = (plans ?? []).map((p) => {
        const finished = finishedByTutor.get(p.tutor_external_id) ?? new Set<string>();
        const planItems = itemsByPlan.get(p.id) ?? [];

        const planned_modules: PlannedModule[] = planItems.map((it) => ({
          module_id: it.module_id,
          grade_band: it.study_modules?.grade_band ?? "?",
          module_code: it.study_modules?.module_code ?? "?",
          hours_required: Number(it.study_modules?.hours_required ?? 0),
          planned_hours: Number(it.planned_hours),
          is_partial: !!it.is_partial,
          is_finished: finished.has(it.module_id),
        }));

        const planned_count = planned_modules.length;
        const finished_planned_count = planned_modules.filter((m) => m.is_finished).length;
        const plannedIds = new Set(planned_modules.map((m) => m.module_id));
        const extra_finished_count = Array.from(finished).filter((id) => !plannedIds.has(id)).length;

        const has_post_data = postPublished.some(
          (r) => r.tutor_external_id === p.tutor_external_id,
        );

        const adherence_pct =
          planned_count > 0
            ? Math.round((finished_planned_count / planned_count) * 100)
            : 0;

        let status: AdherenceStatus;
        if (!has_post_data) status = "no_data";
        else if (planned_count === 0) status = "no_data";
        else if (adherence_pct >= 80) status = "on_track";
        else if (adherence_pct >= 40) status = "partial";
        else status = "off_plan";

        return {
          tutor_external_id: p.tutor_external_id,
          tutor_name: p.tutor_name,
          team_leader: p.team_leader,
          planned_modules,
          planned_count,
          finished_planned_count,
          extra_finished_count,
          planned_hours: Number(p.planned_hours),
          free_hours_pre: Number(p.free_hours),
          scheduled_sessions_pre: preSessionsByTutor.get(p.tutor_external_id) ?? null,
          actual_sessions_post: postSessionsByTutor.get(p.tutor_external_id) ?? null,
          adherence_pct,
          status,
          has_post_data,
        };
      });

      return {
        tutors: tutors.sort((a, b) => a.tutor_name.localeCompare(b.tutor_name)),
        has_any_post_modules: postPublished.length > 0,
        has_any_post_sessions: (occPost ?? []).length > 0,
      };
    },
  });
};
