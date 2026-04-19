import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlanStepSummary {
  count: number;
  notes: string[]; // all notes (for first-step detection)
}

/**
 * Fetches step counts and notes for many action plans at once.
 * Returns a map keyed by plan_id.
 */
export function usePlanStepSummaries(planIds: string[]) {
  const [summaries, setSummaries] = useState<Record<string, PlanStepSummary>>({});
  const [isLoading, setIsLoading] = useState(false);

  const key = planIds.slice().sort().join(",");

  const fetch = useCallback(async () => {
    if (planIds.length === 0) {
      setSummaries({});
      return;
    }
    setIsLoading(true);
    const { data } = await supabase
      .from("action_plan_steps")
      .select("plan_id, note")
      .in("plan_id", planIds);
    const map: Record<string, PlanStepSummary> = {};
    for (const id of planIds) map[id] = { count: 0, notes: [] };
    if (data) {
      for (const row of data as { plan_id: string; note: string }[]) {
        const s = map[row.plan_id];
        if (s) {
          s.count += 1;
          s.notes.push(row.note);
        }
      }
    }
    setSummaries(map);
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { summaries, isLoading, refetch: fetch };
}
