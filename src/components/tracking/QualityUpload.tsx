import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Strict expected columns. Tutor ID is the canonical identifier (names may change).
const COLUMN_ALIASES: Record<string, string[]> = {
  tutor_id: ["Tutor ID", "Tutor Id", "TutorID", "Mentor ID", "Agent ID"],
  agent_name: ["Agent Name", "Instructor's Name", "Instructor Name", "Mentor", "Tutor Name"],
  team_leader: ["Team Leader"],
  session_date: ["Date", "Session Date"],
  score: ["Score"],
};

interface QualityUploadProps {
  onUploaded: (count: number) => void;
}

interface ParsedRow {
  tutor_id: string;
  agent_name: string;
  team_leader: string;
  session_date: string | null;
  score: number;
}

function findColumn(headers: string[], aliases: string[]): string | null {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const a of aliases) {
    const idx = lower.indexOf(a.toLowerCase());
    if (idx >= 0) return headers[idx];
  }
  return null;
}

function excelDateToISO(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    // Excel serial date
    const utcDays = Math.floor(value - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  // Try common formats
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const dd = new Date(iso);
    if (!isNaN(dd.getTime())) return iso;
  }
  return null;
}

export const QualityUpload = ({ onUploaded }: QualityUploadProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: true,
      });

      if (json.length === 0) {
        throw new Error("The uploaded sheet is empty.");
      }

      const headers = Object.keys(json[0]);
      const colMap = {
        tutor_id: findColumn(headers, COLUMN_ALIASES.tutor_id),
        agent_name: findColumn(headers, COLUMN_ALIASES.agent_name),
        team_leader: findColumn(headers, COLUMN_ALIASES.team_leader),
        session_date: findColumn(headers, COLUMN_ALIASES.session_date),
        score: findColumn(headers, COLUMN_ALIASES.score),
      };

      const missing = Object.entries(colMap)
        .filter(([, v]) => v === null)
        .map(([k]) => COLUMN_ALIASES[k][0]);

      if (missing.length > 0) {
        throw new Error(
          `Invalid sheet structure. Missing required columns: ${missing.join(", ")}.`
        );
      }

      const cleaned: ParsedRow[] = [];
      let skipped = 0;

      for (const row of json) {
        const tutorId = String(row[colMap.tutor_id!] ?? "").trim();
        const agent = String(row[colMap.agent_name!] ?? "").trim();
        const tl = String(row[colMap.team_leader!] ?? "").trim();
        const dateRaw = row[colMap.session_date!];
        const scoreRaw = row[colMap.score!];

        if (!tutorId && !agent && !tl && (scoreRaw === "" || scoreRaw == null)) {
          continue; // empty row
        }

        const scoreNum = typeof scoreRaw === "number" ? scoreRaw : parseFloat(String(scoreRaw).replace("%", "").trim());
        if (!tutorId || !tl || isNaN(scoreNum)) {
          skipped++;
          continue;
        }

        cleaned.push({
          tutor_id: tutorId,
          agent_name: agent || tutorId,
          team_leader: tl,
          session_date: excelDateToISO(dateRaw),
          score: scoreNum,
        });
      }

      if (cleaned.length === 0) {
        throw new Error("No valid rows found after cleaning.");
      }

      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");

      // Replace existing data uploaded by this user (MVP behavior)
      const { error: delErr } = await supabase
        .from("quality_uploads")
        .delete()
        .eq("uploaded_by", user.id);
      if (delErr) throw delErr;

      // Insert in batches of 500
      const batchSize = 500;
      const records = cleaned.map((r) => ({ ...r, uploaded_by: user.id }));
      for (let i = 0; i < records.length; i += batchSize) {
        const { error: insErr } = await supabase
          .from("quality_uploads")
          .insert(records.slice(i, i + batchSize));
        if (insErr) throw insErr;
      }

      const msg = `Uploaded ${cleaned.length} record${cleaned.length === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}.`;
      setSuccess(msg);
      toast({ title: "Upload successful", description: msg });
      onUploaded(cleaned.length);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Upload failed.";
      setError(message);
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
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
          <h3 className="text-lg font-semibold">Upload Quality Sheet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Accepted formats: .xlsx, .csv. Required columns:{" "}
            <span className="font-medium text-foreground">Tutor ID</span>,{" "}
            <span className="font-medium text-foreground">Team Leader</span>,{" "}
            <span className="font-medium text-foreground">Score</span>. Optional:{" "}
            <span className="font-medium text-foreground">Instructor's Name</span>,{" "}
            <span className="font-medium text-foreground">Session Date</span>.
            Tutors are tracked by Tutor ID, so name changes won't split their stats.
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
          <Button onClick={() => fileRef.current?.click()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Choose File
              </>
            )}
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
