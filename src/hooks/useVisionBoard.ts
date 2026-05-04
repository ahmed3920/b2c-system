import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type VisionPlan = Database["public"]["Tables"]["vision_board_plans"]["Row"];
export type VisionTag = Database["public"]["Tables"]["vision_board_tags"]["Row"];
export type VisionStatus = Database["public"]["Enums"]["vision_plan_status"];
export type VisionUrgency = Database["public"]["Enums"]["vision_plan_urgency"];

export const URGENCY_COLUMNS: { id: VisionUrgency; title: string; color: string; description: string }[] = [
  { id: "critical", title: "Critical", color: "destructive", description: "Immediate action required" },
  { id: "high", title: "High Priority", color: "orange", description: "Address soon" },
  { id: "medium", title: "Medium Priority", color: "blue", description: "On the roadmap" },
  { id: "low", title: "Low Priority / Future", color: "muted", description: "Future plans" },
  { id: "completed", title: "Completed", color: "green", description: "Finished plans" },
];

export const STATUS_LABELS: Record<VisionStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

export function useVisionBoard() {
  const [plans, setPlans] = useState<VisionPlan[]>([]);
  const [tags, setTags] = useState<VisionTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("vision_board_plans").select("*").order("position", { ascending: true }),
      supabase.from("vision_board_tags").select("*").eq("is_active", true).order("display_order"),
    ]);
    setPlans(p ?? []);
    setTags(t ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("vision-board-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "vision_board_plans" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "vision_board_tags" }, () => fetchAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  return { plans, tags, loading, refetch: fetchAll };
}
