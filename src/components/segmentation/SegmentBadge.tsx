import { Badge } from "@/components/ui/badge";
import type { TutorSegment, TutorTrend } from "@/hooks/useTutorSegmentation";

export function SegmentBadge({ segment }: { segment: TutorSegment }) {
  const map: Record<TutorSegment, { label: string; cls: string }> = {
    elite: { label: "Elite", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400" },
    growth: { label: "Growth", cls: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400" },
    at_risk: { label: "At Risk", cls: "bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-400" },
  };
  const s = map[segment];
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}

export function TrendIndicator({ trend }: { trend: TutorTrend }) {
  const icon = trend === "up" ? "📈" : trend === "down" ? "📉" : "➡️";
  const label = trend === "up" ? "Improving" : trend === "down" ? "Declining" : "Stable";
  return <span title={label} className="text-base leading-none">{icon}</span>;
}
