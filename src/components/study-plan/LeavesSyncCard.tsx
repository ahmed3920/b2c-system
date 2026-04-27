import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Download, Settings2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const FIELDS = [
  "tutor_external_id",
  "tutor_name",
  "team_leader",
  "is_mentor",
  "leave_reason",
  "leave_start",
  "leave_end",
  "leave_rule_id",
  "effective_days",
];
const DEFAULTS: Record<string, string> = {
  tutor_external_id: "Tutors - Requester  T ID",
  tutor_name: "Name I18n  En",
  team_leader: "Admins - Team Lead Name",
  is_mentor: "IsMentor",
  leave_reason: "Leaves Reason",
  leave_start: "Start Date: Day",
  leave_end: "End Date: Day",
  leave_rule_id: "Leave Rule ID",
  effective_days: "Effective Days",
};

export function LeavesSyncCard() {
  const [csvUrl, setCsvUrl] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("study_plan_sheet_configs")
        .select("csv_url, column_mapping")
        .eq("sheet_kind", "leaves")
        .maybeSingle();
      const m = (data?.column_mapping ?? {}) as Record<string, string>;
      const merged: Record<string, string> = {};
      for (const f of FIELDS) merged[f] = m[f] ?? DEFAULTS[f] ?? f;
      setMapping(merged);
      setCsvUrl(data?.csv_url ?? "");
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("study_plan_sheet_configs")
        .update({ csv_url: csvUrl.trim(), column_mapping: mapping })
        .eq("sheet_kind", "leaves");
      if (error) throw error;
      toast.success("Leaves sheet config saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!csvUrl.trim()) {
      toast.error("Set a sheet URL first");
      return;
    }
    setSyncing(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "sync-leaves-from-sheet",
        { body: {} },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      setLastResult(
        `Parsed ${d.rows_parsed} rows · imported ${d.leave_days_inserted} leave-days · skipped ${d.rows_skipped}`,
      );
      toast.success("Leaves synced");
      if (d.warnings?.length)
        toast.warning(`${d.warnings.length} warning(s) — see card`);
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed");
      setLastResult(`Error: ${e?.message ?? "unknown"}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Planned leaves</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Each leave day inside the working week subtracts 5h (one full
              session day) from the tutor's free hours when generating the plan.
            </p>
          </div>
          <Badge variant="outline">Leaves</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Google Sheets URL</Label>
          <Input
            value={csvUrl}
            onChange={(e) => setCsvUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
            disabled={loading}
          />
        </div>

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2">
              <Settings2 className="h-3.5 w-3.5" /> Column mapping
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="grid grid-cols-2 gap-2">
              {FIELDS.map((f) => (
                <div key={f}>
                  <Label className="text-xs text-muted-foreground">{f}</Label>
                  <Input
                    value={mapping[f] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [f]: e.target.value }))
                    }
                    className="h-8"
                    placeholder={f}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Dates can be DD/MM/YYYY, YYYY-MM-DD, etc. A row with From=24/4 To=27/4
              creates 4 leave-days (24, 25, 26, 27).
            </p>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save config
          </Button>
          <Button size="sm" onClick={handleSync} disabled={syncing || loading}>
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Sync leaves
          </Button>
        </div>

        {lastResult && (
          <p className="text-xs text-muted-foreground">{lastResult}</p>
        )}
      </CardContent>
    </Card>
  );
}
