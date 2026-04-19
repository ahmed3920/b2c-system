import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, Minus, Save, AlertTriangle, CheckCircle2, Calendar } from "lucide-react";
import { format, addMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ActionPlan } from "@/hooks/useActionPlans";

interface Props {
  plan: ActionPlan;
  onSaved: (updates: Partial<ActionPlan>) => void;
}

/**
 * Quality follow-up scores: baseline (start month) + M1/M2/M3.
 * Baseline = quality score for the month the plan was created (start_date).
 * Action plans are followed for 3 months — TLs enter the actual scores here.
 */
export function QualityScoresEditor({ plan, onSaved }: Props) {
  const [baseline, setBaseline] = useState<string>("");
  const [m1, setM1] = useState<string>("");
  const [m2, setM2] = useState<string>("");
  const [m3, setM3] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Sync local state when the plan changes (e.g. dialog reopened on another plan).
  useEffect(() => {
    setBaseline(plan.quality_baseline_score?.toString() ?? "");
    setM1(plan.quality_month1_score?.toString() ?? "");
    setM2(plan.quality_month2_score?.toString() ?? "");
    setM3(plan.quality_month3_score?.toString() ?? "");
  }, [plan.id, plan.quality_baseline_score, plan.quality_month1_score, plan.quality_month2_score, plan.quality_month3_score]);

  const start = new Date(plan.start_date);

  // Validate: blank → null; otherwise parse and clamp to 0..100.
  const parse = (v: string): number | null => {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, n));
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = {
      quality_baseline_score: parse(baseline),
      quality_month1_score: parse(m1),
      quality_month2_score: parse(m2),
      quality_month3_score: parse(m3),
    };
    const { error } = await supabase.from("action_plans").update(updates).eq("id", plan.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save quality scores", { description: error.message });
      return;
    }
    toast.success("Quality scores saved");
    onSaved(updates);
  };

  const baseNum = parse(baseline);

  // Build the 3-month follow-up schedule. Each entry shows the month label,
  // the score (if entered), the delta vs baseline, and what step the TL must take next.
  const schedule = useMemo(() => {
    const months = [
      { idx: 1, label: "Month 1", value: parse(m1), date: addMonths(start, 1) },
      { idx: 2, label: "Month 2", value: parse(m2), date: addMonths(start, 2) },
      { idx: 3, label: "Month 3", value: parse(m3), date: addMonths(start, 3) },
    ];
    return months.map((m) => {
      const delta = m.value !== null && baseNum !== null ? m.value - baseNum : null;
      const needsRemeeting = m.value !== null && baseNum !== null && m.value < baseNum;
      const improved = m.value !== null && baseNum !== null && m.value >= baseNum;
      return { ...m, delta, needsRemeeting, improved };
    });
  }, [m1, m2, m3, baseNum, start]);

  return (
    <div className="space-y-3 border rounded-md p-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Quality Scores (3-month follow-up)</Label>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
          Save
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Baseline = quality score for the month the plan was created (must be &lt; 90 to open this plan).
        Enter each follow-up score below. If a follow-up score drops <strong>below the baseline</strong>,
        a re-meeting with the tutor is required.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScoreField
          label={`Baseline (${format(start, "MMM yyyy")})`}
          value={baseline}
          onChange={setBaseline}
          baseline={null}
          highlight="baseline"
        />
        <ScoreField
          label={`Month 1 (${format(addMonths(start, 1), "MMM yyyy")})`}
          value={m1}
          onChange={setM1}
          baseline={baseNum}
        />
        <ScoreField
          label={`Month 2 (${format(addMonths(start, 2), "MMM yyyy")})`}
          value={m2}
          onChange={setM2}
          baseline={baseNum}
        />
        <ScoreField
          label={`Month 3 (${format(addMonths(start, 3), "MMM yyyy")})`}
          value={m3}
          onChange={setM3}
          baseline={baseNum}
        />
      </div>

      {baseNum !== null && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Follow-up Schedule
          </Label>
          <ol className="space-y-2">
            {schedule.map((m) => {
              const stateClass = m.needsRemeeting
                ? "border-destructive/50 bg-destructive/5"
                : m.improved
                ? "border-green-500/40 bg-green-500/5"
                : "border-border bg-background";
              return (
                <li
                  key={m.idx}
                  className={`flex items-start gap-3 rounded-md border p-2.5 text-xs ${stateClass}`}
                >
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold">
                    {m.idx}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {m.label} · {format(m.date, "MMM yyyy")}
                      </span>
                      {m.value !== null && (
                        <span className="font-mono">
                          Score: <strong>{m.value}</strong>
                          {m.delta !== null && (
                            <span
                              className={
                                m.delta > 0
                                  ? "text-green-600 ml-1"
                                  : m.delta < 0
                                  ? "text-destructive ml-1"
                                  : "text-muted-foreground ml-1"
                              }
                            >
                              ({m.delta > 0 ? "+" : ""}
                              {m.delta.toFixed(1)} vs baseline)
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    {m.value === null ? (
                      <p className="text-muted-foreground">
                        Pending — record this month's score after the monthly review.
                      </p>
                    ) : m.needsRemeeting ? (
                      <p className="text-destructive flex items-start gap-1 font-medium">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        Score dropped below baseline → schedule another meeting with the tutor and log
                        it as an update in the timeline below.
                      </p>
                    ) : (
                      <p className="text-green-600 dark:text-green-500 flex items-start gap-1">
                        <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        On track — score is at or above baseline. Continue monitoring.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function ScoreField({
  label,
  value,
  onChange,
  baseline,
  highlight,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  baseline: number | null;
  highlight?: "baseline";
}) {
  const num = value.trim() === "" ? null : Number(value);
  const valid = num === null || (Number.isFinite(num) && num >= 0 && num <= 100);
  const delta = num !== null && baseline !== null && Number.isFinite(num) ? num - baseline : null;

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        max={100}
        step="0.1"
        placeholder="—"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 ${highlight === "baseline" ? "border-primary/40" : ""} ${!valid ? "border-destructive" : ""}`}
      />
      {delta !== null ? (
        <div className={`text-[11px] flex items-center gap-1 font-medium ${
          delta > 0 ? "text-green-600" : delta < 0 ? "text-destructive" : "text-muted-foreground"
        }`}>
          {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {delta > 0 ? "+" : ""}{delta.toFixed(1)} vs baseline
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground">&nbsp;</div>
      )}
    </div>
  );
}
