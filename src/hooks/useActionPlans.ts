import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useInactiveTutorIds } from "@/hooks/useInactiveTutorIds";

export type ActionPlanCategory = Database["public"]["Enums"]["action_plan_category"];
export type ActionPlanStatus = Database["public"]["Enums"]["action_plan_status"];
export type ActionPlanEvaluation = Database["public"]["Enums"]["action_plan_evaluation"];

export interface ActionPlan {
  id: string;
  tutor_name: string;
  tutor_external_id: string | null;
  team_leader: string;
  category: ActionPlanCategory;
  status: ActionPlanStatus;
  summary: string | null;
  start_date: string;
  due_date: string;
  progress: number;
  evaluation: ActionPlanEvaluation | null;
  evaluation_notes: string | null;
  resolved_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  /** Quality score for the month the plan was created (baseline). */
  quality_baseline_score: number | null;
  /** Follow-up quality scores for months 1, 2, 3 after plan creation. */
  quality_month1_score: number | null;
  quality_month2_score: number | null;
  quality_month3_score: number | null;
}

export interface ActionPlanStep {
  id: string;
  plan_id: string;
  author_id: string;
  author_name: string | null;
  note: string;
  status_change: ActionPlanStatus | null;
  progress_change: number | null;
  created_at: string;
}

export interface ActionPlanTutor {
  id: string;
  tutor_external_id: string | null;
  tutor_name: string;
  team_leader: string;
  mentor_name: string | null;
  is_mentor: boolean | null;
  language: string | null;
}

export const CATEGORY_LABELS: Record<ActionPlanCategory, string> = {
  quality: "Quality",
  emergency_abuse: "Emergency Abuse",
  no_show_abuse: "No Show Abuse",
  communication: "Communication",
  cs_complaints: "CS Complaints",
  leaves_abuse: "Leaves Abuse (Legacy)",
};

// Categories shown in the picker (legacy ones hidden)
export const SELECTABLE_CATEGORIES: ActionPlanCategory[] = [
  "quality",
  "emergency_abuse",
  "no_show_abuse",
  "communication",
  "cs_complaints",
];

export const STATUS_LABELS: Record<ActionPlanStatus, string> = {
  active: "Active",
  on_hold: "On Hold",
  resolved: "Resolved",
  escalated: "Escalated",
};

export function useActionPlans() {
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("action_plans")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setPlans(data as ActionPlan[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { plans, isLoading, refetch: fetch };
}

export function useActionPlanTutors() {
  const [tutors, setTutors] = useState<ActionPlanTutor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("action_plan_tutors")
        .select("*")
        .order("tutor_name");
      if (data) setTutors(data as ActionPlanTutor[]);
      setIsLoading(false);
    })();
  }, []);

  return { tutors, isLoading };
}

export function useActionPlanSteps(planId: string | null) {
  const [steps, setSteps] = useState<ActionPlanStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!planId) {
      setSteps([]);
      return;
    }
    setIsLoading(true);
    const { data } = await supabase
      .from("action_plan_steps")
      .select("*")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true });
    if (data) setSteps(data as ActionPlanStep[]);
    setIsLoading(false);
  }, [planId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { steps, isLoading, refetch: fetch };
}
