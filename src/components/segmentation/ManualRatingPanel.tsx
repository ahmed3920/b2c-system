import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  tutorExternalId: string;
  tutorName: string;
  teamLeader: string | null;
}

type Metric = "communication" | "tl_feedback" | "culture_fit" | "parent_handling";

const METRICS: { key: Metric; label: string }[] = [
  { key: "communication", label: "Communication" },
  { key: "tl_feedback", label: "TL Feedback" },
  { key: "culture_fit", label: "Culture Fit" },
  { key: "parent_handling", label: "Parent Handling" },
];

function currentPeriodMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function ManualRatingPanel({ tutorExternalId, tutorName, teamLeader }: Props) {
  const { role, isAdmin } = useUserRole();
  const canEdit = isAdmin || role === "team_leader" || role === "super_team_leader";
  const period = currentPeriodMonth();

  const [values, setValues] = useState<Record<Metric, number | null>>({
    communication: null, tl_feedback: null, culture_fit: null, parent_handling: null,
  });
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tutor_manual_ratings" as any)
        .select("communication, tl_feedback, culture_fit, parent_handling, note")
        .eq("tutor_external_id", tutorExternalId)
        .eq("period_month", period)
        .maybeSingle();
      const row = data as any;
      setValues({
        communication: row?.communication ?? null,
        tl_feedback: row?.tl_feedback ?? null,
        culture_fit: row?.culture_fit ?? null,
        parent_handling: row?.parent_handling ?? null,
      });
      setNote(row?.note ?? "");
      setLoading(false);
    })();
  }, [tutorExternalId, period]);

  const save = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const payload: any = {
        tutor_external_id: tutorExternalId,
        tutor_name: tutorName,
        team_leader: teamLeader,
        period_month: period,
        ...values,
        note: note || null,
        rated_by: userData?.user?.id ?? null,
        rated_by_name: userData?.user?.email ?? null,
      };
      const { error } = await supabase
        .from("tutor_manual_ratings" as any)
        .upsert(payload, { onConflict: "tutor_external_id,period_month" });
      if (error) throw error;
      toast.success("Rating saved. Recompute segmentation to apply.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save rating");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Manual Ratings — {period.slice(0, 7)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {METRICS.map((m) => (
                <div key={m.key} className="space-y-1">
                  <Label className="text-xs">{m.label} (1–5)</Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant={values[m.key] === n ? "default" : "outline"}
                        disabled={!canEdit}
                        onClick={() => setValues((v) => ({ ...v, [m.key]: n }))}
                        className="w-9"
                      >
                        {n}
                      </Button>
                    ))}
                    {values[m.key] != null && canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => setValues((v) => ({ ...v, [m.key]: null }))}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={!canEdit}
                rows={2}
                placeholder="Optional context"
              />
            </div>
            {canEdit && (
              <Button size="sm" onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                Save ratings
              </Button>
            )}
            {!canEdit && (
              <div className="text-xs text-muted-foreground">Only admins and team leaders can edit ratings.</div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
