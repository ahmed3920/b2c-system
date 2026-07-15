import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeTeamLeaderName } from "@/lib/teamLeaders";

export type TutorSegment = "elite" | "growth" | "at_risk";
export type TutorTrend = "up" | "flat" | "down";
export type TutorConfidence = "high" | "medium" | "low";

export interface SegmentationScore {
  id: string;
  tutor_external_id: string;
  tutor_name: string;
  team_leader: string | null;
  language: string | null;
  snapshot_date: string;
  quality_score: number | null;
  planned_leaves_score: number | null;
  emergency_leaves_score: number | null;
  live_issues_score: number | null;
  cs_tickets_score: number | null;
  communication_score: number | null;
  tl_feedback_score: number | null;
  engagement_score: number | null;
  parent_handling_score: number | null;
  culture_fit_score: number | null;
  health_score: number;
  segment: TutorSegment;
  trend: TutorTrend;
  confidence: TutorConfidence;
  hard_stop_reason: string | null;
  next_action: string | null;
  metrics_meta: Record<string, any>;
  updated_at: string;
}

export interface SegmentationRecommendation {
  id: string;
  tutor_external_id: string;
  tutor_name: string;
  team_leader: string | null;
  rule_id: string;
  title: string;
  description: string | null;
  severity: "info" | "warning" | "critical";
  suggested_action: string | null;
  status: "open" | "in_progress" | "resolved" | "dismissed";
  triggered_at: string;
}

export function useTutorSegmentation() {
  const [scores, setScores] = useState<SegmentationScore[]>([]);
  const [recommendations, setRecommendations] = useState<SegmentationRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    // Get latest snapshot_date, then rows for that date
    const { data: latest } = await supabase
      .from("tutor_segmentation_scores" as any)
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1);
    const latestDate = (latest as any[])?.[0]?.snapshot_date as string | undefined;

    if (latestDate) {
      const { data } = await supabase
        .from("tutor_segmentation_scores" as any)
        .select("*")
        .eq("snapshot_date", latestDate)
        .order("health_score", { ascending: false });
      setScores(
        (((data as any[]) ?? []) as SegmentationScore[])
          .map((score) => ({
            ...score,
            team_leader: normalizeTeamLeaderName(score.team_leader),
          }))
          .filter((score) => Boolean(score.team_leader)),
      );
    } else {
      setScores([]);
    }

    const { data: recs } = await supabase
      .from("tutor_segmentation_recommendations" as any)
      .select("*")
      .eq("status", "open")
      .order("severity", { ascending: false });
    setRecommendations(
      (((recs as any[]) ?? []) as SegmentationRecommendation[])
        .map((rec) => ({
          ...rec,
          team_leader: normalizeTeamLeaderName(rec.team_leader),
        }))
        .filter((rec) => Boolean(rec.team_leader)),
    );
    setLoading(false);
  }, []);

  const recompute = useCallback(async (context: Record<string, unknown> = {}) => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("compute-tutor-segmentation", { body: { context } });
      if (error) throw error;
      await refresh();
    } finally {
      setRunning(false);
    }
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { scores, recommendations, loading, running, refresh, recompute };
}
