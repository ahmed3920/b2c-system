import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RefreshCw, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface SyncConfig {
  id: string;
  csv_url: string | null;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  last_sync_rows: number | null;
}

interface Props {
  isAdmin: boolean;
  onSynced?: () => void;
}

export function LiveIssuesSyncCard({ isAdmin, onSynced }: Props) {
  const [cfg, setCfg] = useState<SyncConfig | null>(null);
  const [csvUrl, setCsvUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("live_issues_sheet_config")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (data) {
      setCfg(data as SyncConfig);
      setCsvUrl(data.csv_url ?? "");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("live_issues_sheet_config")
        .update({ csv_url: csvUrl.trim() || null })
        .eq("id", cfg.id);
      if (error) throw error;
      toast.success("Sheet URL saved");
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "sync-live-issues-from-sheet",
        { body: {} },
      );
      if (error) throw error;
      const d = data as { error?: string; rows_upserted?: number; rows_skipped?: number };
      if (d?.error) throw new Error(d.error);
      toast.success(`Synced ${d.rows_upserted ?? 0} cases`);
      await load();
      onSynced?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      toast.error(msg);
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const statusBadge = () => {
    if (syncing) return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Syncing</Badge>;
    if (!cfg?.last_synced_at) return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Never synced</Badge>;
    if (cfg.last_sync_status === "error") return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Error</Badge>;
    return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="h-3 w-3" />Synced</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Moderation Sheet Sync</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Pull live session issues from the moderation Google Sheet. Sheet must be shared as
              "Anyone with the link (Viewer)" or published to web.
            </p>
          </div>
          {statusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdmin && (
          <div>
            <Label className="text-xs">Google Sheets URL</Label>
            <Input
              value={csvUrl}
              onChange={(e) => setCsvUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
              disabled={loading}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || loading}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save URL
              </Button>
              <Button size="sm" onClick={handleSync} disabled={syncing || loading || !cfg?.csv_url}>
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Sync with Sheet
              </Button>
            </>
          )}
          {cfg?.last_synced_at && (
            <span className="text-xs text-muted-foreground">
              Last sync: {formatDistanceToNow(new Date(cfg.last_synced_at), { addSuffix: true })}
              {typeof cfg.last_sync_rows === "number" && ` · ${cfg.last_sync_rows} rows`}
            </span>
          )}
        </div>

        {cfg?.last_sync_status === "error" && cfg.last_sync_message && (
          <p className="text-xs text-destructive">{cfg.last_sync_message}</p>
        )}
      </CardContent>
    </Card>
  );
}
