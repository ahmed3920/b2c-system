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

export type SheetKind =
  | "upcoming_sessions"
  | "pre_modules"
  | "ended_sessions"
  | "post_modules";

const SESSION_FIELDS = [
  "tutor_external_id",
  "tutor_name",
  "team_leader",
  "scheduled_sessions",
];
const MODULE_FIELDS = [
  "tutor_external_id",
  "tutor_name",
  "team_leader",
  "grade_band",
  "module_code",
  "is_finished",
];

interface Props {
  kind: SheetKind;
  title: string;
  description: string;
  weekStart: string;
}

export function SheetSyncCard({ kind, title, description, weekStart }: Props) {
  const isSessions =
    kind === "upcoming_sessions" || kind === "ended_sessions";
  const fields = isSessions ? SESSION_FIELDS : MODULE_FIELDS;

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
        .eq("sheet_kind", kind)
        .maybeSingle();
      if (data) {
        setCsvUrl(data.csv_url ?? "");
        const m = (data.column_mapping ?? {}) as Record<string, string>;
        const merged: Record<string, string> = {};
        for (const f of fields) merged[f] = m[f] ?? f;
        setMapping(merged);
      } else {
        const merged: Record<string, string> = {};
        for (const f of fields) merged[f] = f;
        setMapping(merged);
      }
      setLoading(false);
    })();
  }, [kind]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("study_plan_sheet_configs")
        .update({ csv_url: csvUrl.trim(), column_mapping: mapping })
        .eq("sheet_kind", kind);
      if (error) throw error;
      toast.success("Sheet config saved");
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
        "sync-study-plan-sheet",
        { body: { sheet_kind: kind, week_start: weekStart } },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      setLastResult(
        `Parsed ${d.rows_parsed} rows · imported ${d.rows_inserted} · skipped ${d.rows_skipped}`,
      );
      toast.success(`Synced ${title}`);
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
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <Badge variant={isSessions ? "default" : "secondary"}>
            {isSessions ? "Sessions" : "Modules"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Google Sheets URL (any link works)</Label>
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
              {fields.map((f) => (
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
              Map each system field to the actual column header in your sheet.
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
            Sync week
          </Button>
        </div>

        {lastResult && (
          <p className="text-xs text-muted-foreground">{lastResult}</p>
        )}
      </CardContent>
    </Card>
  );
}
