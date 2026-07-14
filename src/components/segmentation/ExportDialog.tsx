import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import type { SegmentationScore } from "@/hooks/useTutorSegmentation";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rows: SegmentationScore[];
  filterSummary?: string;
}

type GroupKey = "identity" | "system" | "liveIssues" | "csTickets" | "manual" | "scores" | "meta";

const GROUPS: { key: GroupKey; label: string; desc: string }[] = [
  { key: "identity", label: "Identity", desc: "Tutor ID, name, team leader, language" },
  { key: "system", label: "System numbers", desc: "Total sessions, quality samples, leaves counts, engagement samples" },
  { key: "liveIssues", label: "Live issues (deducted only)", desc: "Weighted deducted live-issue count + score" },
  { key: "csTickets", label: "CS tickets", desc: "Weighted valid CS tickets + score" },
  { key: "manual", label: "Manual metrics", desc: "Communication, TL Feedback, Culture Fit, Parent Handling" },
  { key: "scores", label: "Health & segment", desc: "Health score, segment, trend, confidence, next action" },
  { key: "meta", label: "Snapshot metadata", desc: "Snapshot date, hard stop reason" },
];

const csvEscape = (v: unknown) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function ExportDialog({ open, onOpenChange, rows, filterSummary }: Props) {
  const [selected, setSelected] = useState<Record<GroupKey, boolean>>({
    identity: true, system: true, liveIssues: true, csTickets: true, manual: true, scores: true, meta: true,
  });

  const toggle = (k: GroupKey) => setSelected((p) => ({ ...p, [k]: !p[k] }));

  const handleExport = () => {
    if (!rows.length) { toast.error("No rows to export"); return; }
    const headers: string[] = [];
    const getters: ((r: SegmentationScore) => unknown)[] = [];
    const push = (h: string, g: (r: SegmentationScore) => unknown) => { headers.push(h); getters.push(g); };

    if (selected.identity) {
      push("Tutor ID", (r) => r.tutor_external_id);
      push("Tutor Name", (r) => r.tutor_name);
      push("Team Leader", (r) => r.team_leader ?? "");
      push("Language", (r) => r.language ?? "");
    }
    if (selected.system) {
      push("Total Sessions", (r) => r.metrics_meta?.total_sessions ?? "");
      push("Quality Samples", (r) => r.metrics_meta?.quality_samples ?? "");
      push("Planned Leaves (count)", (r) => r.metrics_meta?.leaves?.plannedCount ?? "");
      push("Planned Leaves /month", (r) => r.metrics_meta?.leaves?.plannedPerMonth ?? "");
      push("Emergency Leaves (count)", (r) => r.metrics_meta?.leaves?.emergencyCount ?? "");
      push("Emergency Leaves /month", (r) => r.metrics_meta?.leaves?.emergencyPerMonth ?? "");
      push("Engagement Samples", (r) => r.metrics_meta?.engagement_samples ?? "");
    }
    if (selected.liveIssues) {
      push("Live Issues (deducted, weighted)", (r) => r.metrics_meta?.live_issues_weighted ?? "");
      push("Live Issues Score", (r) => r.live_issues_score ?? "");
    }
    if (selected.csTickets) {
      push("CS Tickets (valid, weighted)", (r) => r.metrics_meta?.cs_valid_weighted ?? "");
      push("CS Tickets Score", (r) => r.cs_tickets_score ?? "");
    }
    if (selected.scores) {
      push("Quality Score", (r) => r.quality_score ?? "");
      push("Planned Leaves Score", (r) => r.planned_leaves_score ?? "");
      push("Emergency Leaves Score", (r) => r.emergency_leaves_score ?? "");
      push("Engagement Score", (r) => r.engagement_score ?? "");
      push("Health Score", (r) => r.health_score);
      push("Segment", (r) => r.segment);
      push("Trend", (r) => r.trend);
      push("Confidence", (r) => r.confidence);
      push("Next Action", (r) => r.next_action ?? "");
    }
    if (selected.manual) {
      push("Communication (manual)", (r) => r.communication_score ?? "");
      push("TL Feedback (manual)", (r) => r.tl_feedback_score ?? "");
      push("Culture Fit (manual)", (r) => r.culture_fit_score ?? "");
      push("Parent Handling (manual)", (r) => r.parent_handling_score ?? "");
    }
    if (selected.meta) {
      push("Snapshot Date", (r) => r.snapshot_date);
      push("Hard Stop Reason", (r) => r.hard_stop_reason ?? "");
    }

    const lines = [headers.map(csvEscape).join(",")];
    for (const r of rows) lines.push(getters.map((g) => csvEscape(g(r))).join(","));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tutor-segmentation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} tutors`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Tutor Segmentation</DialogTitle>
          <DialogDescription>
            Exports {rows.length} tutor{rows.length === 1 ? "" : "s"} (current filters applied).
            {filterSummary ? ` ${filterSummary}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {GROUPS.map((g) => (
            <div key={g.key} className="flex items-start gap-3">
              <Checkbox id={`col-${g.key}`} checked={selected[g.key]} onCheckedChange={() => toggle(g.key)} />
              <div className="grid gap-0.5">
                <Label htmlFor={`col-${g.key}`} className="cursor-pointer font-medium">{g.label}</Label>
                <p className="text-xs text-muted-foreground">{g.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport}><Download className="h-4 w-4 mr-2" /> Download CSV</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
