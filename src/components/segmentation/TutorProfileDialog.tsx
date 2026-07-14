import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SegmentBadge, TrendIndicator } from "./SegmentBadge";
import type { SegmentationScore, SegmentationRecommendation } from "@/hooks/useTutorSegmentation";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  score: SegmentationScore | null;
  recommendations: SegmentationRecommendation[];
}

const METRICS: [keyof SegmentationScore, string, number][] = [
  ["quality_score", "Quality", 30],
  ["planned_leaves_score", "Planned Leaves", 5],
  ["emergency_leaves_score", "Emergency Leaves", 5],
  ["live_issues_score", "Live Issues", 10],
  ["cs_tickets_score", "CS Tickets", 10],
  ["communication_score", "Communication", 10],
  ["tl_feedback_score", "TL Feedback", 10],
  ["engagement_score", "Engagement", 10],
  ["parent_handling_score", "Parent Handling", 5],
  ["culture_fit_score", "Culture Fit", 5],
];

export function TutorProfileDialog({ open, onOpenChange, score, recommendations }: Props) {
  if (!score) return null;
  const recs = recommendations.filter((r) => r.tutor_external_id === score.tutor_external_id);
  const scored = METRICS
    .map(([k, l, w]) => ({ key: k, label: l, weight: w, value: score[k] as number | null }))
    .filter((m) => m.value != null) as { key: string; label: string; weight: number; value: number }[];
  const strengths = [...scored].sort((a, b) => b.value - a.value).slice(0, 3);
  const weaknesses = [...scored].sort((a, b) => a.value - b.value).slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{score.tutor_name}</span>
            <SegmentBadge segment={score.segment} />
            <TrendIndicator trend={score.trend} />
            {score.confidence !== "high" && (
              <Badge variant="secondary" className="text-xs">
                {score.confidence === "low" ? "Low confidence" : "Medium confidence"}
              </Badge>
            )}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            {score.tutor_external_id} · {score.team_leader ?? "—"} · Health {score.health_score.toFixed(1)}
          </div>
        </DialogHeader>

        {score.hard_stop_reason && (
          <div className="rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-sm">
            <strong>Hard stop:</strong> {score.hard_stop_reason}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm">Metric Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {METRICS.map(([key, label, weight]) => {
                const v = score[key] as number | null;
                return (
                  <div key={key as string} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{label} <span className="text-muted-foreground">({weight}%)</span></span>
                      <span className="font-medium">{v == null ? "—" : v.toFixed(0)}</span>
                    </div>
                    <Progress value={v ?? 0} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Card>
              <CardHeader><CardTitle className="text-sm">Strengths</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                {strengths.length === 0 && <div className="text-muted-foreground">Not enough data.</div>}
                {strengths.map((s) => (
                  <div key={s.key} className="flex justify-between">
                    <span>{s.label}</span><span className="font-medium">{s.value.toFixed(0)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Weaknesses</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                {weaknesses.length === 0 && <div className="text-muted-foreground">Not enough data.</div>}
                {weaknesses.map((s) => (
                  <div key={s.key} className="flex justify-between">
                    <span>{s.label}</span><span className="font-medium">{s.value.toFixed(0)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Recommendations</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recs.length === 0 && <div className="text-muted-foreground">No open recommendations.</div>}
            {recs.map((r) => (
              <div key={r.id} className="rounded border p-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{r.title}</div>
                  <Badge variant={r.severity === "critical" ? "destructive" : r.severity === "warning" ? "default" : "secondary"}>
                    {r.severity}
                  </Badge>
                </div>
                {r.description && <div className="text-muted-foreground text-xs mt-1">{r.description}</div>}
                {r.suggested_action && <div className="text-xs mt-1"><strong>Action:</strong> {r.suggested_action}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
