import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sheet as SheetIcon,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  isAdmin: boolean;
  onSynced: () => void;
}

export const QualitySheetSync = ({ isAdmin, onSynced }: Props) => {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["quality_sheet_csv_url", "quality_sheet_last_sync"]);
      if (data) {
        const map = Object.fromEntries(data.map((d) => [d.key, d.value]));
        setSavedUrl(map.quality_sheet_csv_url || "");
        setUrl(map.quality_sheet_csv_url || "");
        setLastSync(map.quality_sheet_last_sync || null);
      }
      setLoading(false);
    })();
  }, [isAdmin]);

  if (!isAdmin) return null;

  const saveUrl = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const trimmed = url.trim();
      const { data: { user } } = await supabase.auth.getUser();
      const { error: upErr } = await supabase
        .from("app_settings")
        .upsert({ key: "quality_sheet_csv_url", value: trimmed, updated_by: user?.id });
      if (upErr) throw upErr;
      setSavedUrl(trimmed);
      toast({ title: "Sheet URL saved" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save URL";
      setError(msg);
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const { data, error: invErr } = await supabase.functions.invoke(
        "sync-quality-from-sheet",
        {},
      );
      if (invErr) throw invErr;
      if (data?.error) throw new Error(data.error);
      const msg = `${data.inserted} record${data.inserted === 1 ? "" : "s"} synced${
        data.skipped ? ` · ${data.skipped} skipped` : ""
      }`;
      setSuccess(msg);
      setLastSync(new Date().toISOString());
      toast({ title: "Sync complete", description: msg });
      onSynced();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setError(msg);
      toast({ title: "Sync failed", description: msg, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return null;

  const dirty = url.trim() !== savedUrl.trim();

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <SheetIcon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <h3 className="text-lg font-semibold">Sync from Google Sheet</h3>
            <p className="text-sm text-muted-foreground">
              Paste the <span className="font-medium text-foreground">published CSV link</span> of
              your Quality sheet. In Google Sheets: <em>File → Share → Publish to web</em>, choose
              the sheet/tab, select <em>Comma-separated values (.csv)</em>, then copy the link.
              Click "Sync now" anytime to refresh the dashboard.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
              className="flex-1"
            />
            <Button onClick={saveUrl} disabled={saving || !dirty} variant="outline">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save URL
            </Button>
            <Button onClick={syncNow} disabled={syncing || !savedUrl}>
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync now
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {savedUrl ? (
              <a
                href={savedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <ExternalLink className="w-3 h-3" /> Open current sheet
              </a>
            ) : (
              <span>No sheet configured yet.</span>
            )}
            {lastSync && (
              <span>
                Last sync: <span className="font-medium text-foreground">{format(new Date(lastSync), "PPp")}</span>
              </span>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>Sync error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="border-green-500/50 text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </Card>
  );
};
