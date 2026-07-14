import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, Loader2, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onUploaded?: (count: number) => void;
}

const ALIASES: Record<string, string[]> = {
  tutor_external_id: ["T ID", "Tutors - Requester", "Tutor ID", "TutorID", "Tutor Id", "Mentor ID", "Agent ID", "External ID"],
  tutor_name: ["Tutor Name", "Agent Name", "Instructor Name", "Instructor's Name", "Name"],
  team_leader: ["Team Leader", "TL"],
  leave_date: ["Start Date: Day", "Leave Date", "Start Date", "Date", "From"],
  leave_end_date: ["Leave End Date", "End Date", "To"],
  leave_reason: ["Leave Reason", "Reason", "Type"],
  effective_days: ["Effective Days", "Days"],
  is_request: ["Is Request", "Request"],
  is_mentor: ["Is Mentor", "Mentor"],
  language: ["Language"],
};

interface ParsedRow {
  tutor_external_id: string;
  tutor_name: string | null;
  team_leader: string | null;
  leave_date: string;
  leave_end_date: string | null;
  leave_reason: string | null;
  effective_days: number | null;
  is_request: boolean;
  is_mentor: boolean;
  language: string | null;
  source: string;
}

function findColumn(headers: string[], aliases: string[]): string | null {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const a of aliases) {
    const idx = lower.indexOf(a.toLowerCase());
    if (idx >= 0) return headers[idx];
  }
  return null;
}

function toISODate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = new Date(Math.floor(v - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (!isNaN(new Date(iso).getTime())) return iso;
  }
  return null;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v ?? "").trim().toLowerCase();
  return ["yes", "true", "1", "y", "request"].includes(s);
}

function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.round((+new Date(b) - +new Date(a)) / 86400000) + 1);
}

export const LeavesUpload = ({ onUploaded }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
      if (json.length === 0) throw new Error("Sheet is empty.");

      const headers = Object.keys(json[0]);
      const col: Record<string, string | null> = {};
      for (const k of Object.keys(ALIASES)) col[k] = findColumn(headers, ALIASES[k]);

      const missing: string[] = [];
      if (!col.tutor_external_id) missing.push("Tutor ID");
      if (!col.leave_date) missing.push("Leave Date");
      if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}.`);

      const cleaned: ParsedRow[] = [];
      let skipped = 0;
      for (const row of json) {
        const tid = String(row[col.tutor_external_id!] ?? "").trim();
        const startISO = toISODate(row[col.leave_date!]);
        if (!tid || !startISO) { if (tid || startISO) skipped++; continue; }
        const endISO = col.leave_end_date ? toISODate(row[col.leave_end_date]) : null;
        const daysRaw = col.effective_days ? row[col.effective_days] : null;
        const daysNum = daysRaw === "" || daysRaw == null ? null : Number(daysRaw);
        const effective =
          daysNum != null && !isNaN(daysNum) ? daysNum : endISO ? daysBetween(startISO, endISO) : 1;

        cleaned.push({
          tutor_external_id: tid,
          tutor_name: col.tutor_name ? String(row[col.tutor_name] ?? "").trim() || null : null,
          team_leader: col.team_leader ? String(row[col.team_leader] ?? "").trim() || null : null,
          leave_date: startISO,
          leave_end_date: endISO,
          leave_reason: col.leave_reason ? String(row[col.leave_reason] ?? "").trim() || null : null,
          effective_days: effective,
          is_request: col.is_request ? toBool(row[col.is_request]) : false,
          is_mentor: col.is_mentor ? toBool(row[col.is_mentor]) : false,
          language: col.language ? String(row[col.language] ?? "").trim() || null : null,
          source: "upload",
        });
      }
      if (cleaned.length === 0) throw new Error("No valid rows found.");

      // Dedupe within the file on (tutor_external_id, leave_date) to avoid
      // "ON CONFLICT DO UPDATE cannot affect row a second time".
      const dedupMap = new Map<string, ParsedRow>();
      for (const r of cleaned) dedupMap.set(`${r.tutor_external_id}|${r.leave_date}`, r);
      const records = Array.from(dedupMap.values());

      const BATCH = 500;
      for (let i = 0; i < records.length; i += BATCH) {
        const { error: upErr } = await supabase
          .from("tutor_leaves")
          .upsert(records.slice(i, i + BATCH), { onConflict: "tutor_external_id,leave_date" });
        if (upErr) throw upErr;
      }

      const msg = `${records.length} leave${records.length === 1 ? "" : "s"} imported${
        skipped ? ` · ${skipped} skipped (invalid)` : ""
      }`;
      setSuccess(msg);
      toast({ title: "Upload successful", description: msg });
      onUploaded?.(records.length);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed.";
      setError(message);
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold">Upload Leaves File</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Accepted formats: .xlsx, .csv. Required columns:{" "}
            <span className="font-medium text-foreground">Tutor ID</span>,{" "}
            <span className="font-medium text-foreground">Leave Date</span>. Optional:{" "}
            <span className="font-medium text-foreground">Tutor Name</span>,{" "}
            <span className="font-medium text-foreground">Team Leader</span>,{" "}
            <span className="font-medium text-foreground">Leave End Date</span>,{" "}
            <span className="font-medium text-foreground">Leave Reason</span>,{" "}
            <span className="font-medium text-foreground">Effective Days</span>,{" "}
            <span className="font-medium text-foreground">Is Request</span>,{" "}
            <span className="font-medium text-foreground">Is Mentor</span>,{" "}
            <span className="font-medium text-foreground">Language</span>. Existing rows with the
            same tutor + date are updated.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {busy ? "Uploading..." : "Choose file"}
          </Button>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>Invalid file</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mt-4 border-green-500/50 text-green-700 dark:text-green-400">
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
