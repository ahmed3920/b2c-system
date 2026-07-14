import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Template columns: Employee ID | Year | Month | Achieved
const COLUMN_ALIASES: Record<string, string[]> = {
  tutor_id: ["Employee ID", "Tutor ID", "Tutor Id", "TutorID", "Mentor ID", "Agent ID", "T ID"],
  year: ["Year"],
  month: ["Month"],
  score: ["Achieved", "Score", "Quality", "%"],
};

interface QualityUploadProps {
  onUploaded: (count: number) => void;
}

function findColumn(headers: string[], aliases: string[]): string | null {
  const norm = (s: string) => s.trim().toLowerCase();
  const lower = headers.map(norm);
  for (const a of aliases) {
    const idx = lower.indexOf(norm(a));
    if (idx >= 0) return headers[idx];
  }
  return null;
}

export const QualityUpload = ({ onUploaded }: QualityUploadProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Employee ID", "Year", "Month", "Achieved"],
      ["T-1234", new Date().getFullYear(), 1, 95],
      ["T-1234", new Date().getFullYear(), 2, 98],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quality");
    XLSX.writeFile(wb, "quality_upload_template.xlsx");
  };

  const handleFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (json.length === 0) throw new Error("The uploaded sheet is empty.");

      const headers = Object.keys(json[0]);
      const colMap = {
        tutor_id: findColumn(headers, COLUMN_ALIASES.tutor_id),
        year: findColumn(headers, COLUMN_ALIASES.year),
        month: findColumn(headers, COLUMN_ALIASES.month),
        score: findColumn(headers, COLUMN_ALIASES.score),
      };
      const missing = Object.entries(colMap)
        .filter(([, v]) => !v)
        .map(([k]) => COLUMN_ALIASES[k][0]);
      if (missing.length) {
        throw new Error(`Missing required columns: ${missing.join(", ")}.`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");

      const currentYear = new Date().getFullYear();
      type Row = { tutor_id: string; month: number; year: number; score: number };
      const cleaned: Row[] = [];
      let skipped = 0;

      for (const row of json) {
        const tutorId = String(row[colMap.tutor_id!] ?? "").trim();
        const scoreRaw = row[colMap.score!];
        const monthRaw = row[colMap.month!];
        const yearRaw = row[colMap.year!];
        if (!tutorId && scoreRaw === "" && monthRaw === "") continue;

        const scoreNum = typeof scoreRaw === "number"
          ? scoreRaw
          : parseFloat(String(scoreRaw).replace("%", "").trim());
        const monthNum = typeof monthRaw === "number"
          ? Math.floor(monthRaw)
          : parseInt(String(monthRaw).trim(), 10);
        const yearNum = yearRaw === "" || yearRaw == null
          ? currentYear
          : (typeof yearRaw === "number" ? Math.floor(yearRaw) : parseInt(String(yearRaw).trim(), 10));

        if (!tutorId || isNaN(scoreNum) || !monthNum || monthNum < 1 || monthNum > 12 || !yearNum) {
          skipped++;
          continue;
        }
        cleaned.push({ tutor_id: tutorId, month: monthNum, year: yearNum, score: scoreNum });
      }

      if (cleaned.length === 0) throw new Error("No valid rows found.");

      // Delete existing entries by this uploader for the (tutor, month) combos in the file
      const monthGroups = new Map<string, { y: number; m: number; ids: Set<string> }>();
      for (const r of cleaned) {
        const key = `${r.year}-${r.month}`;
        if (!monthGroups.has(key)) monthGroups.set(key, { y: r.year, m: r.month, ids: new Set() });
        monthGroups.get(key)!.ids.add(r.tutor_id);
      }
      for (const { y, m, ids } of monthGroups.values()) {
        const start = `${y}-${String(m).padStart(2, "0")}-01`;
        const nx = new Date(y, m, 1);
        const nxISO = `${nx.getFullYear()}-${String(nx.getMonth() + 1).padStart(2, "0")}-01`;
        const { error: delErr } = await supabase
          .from("quality_uploads")
          .delete()
          .eq("uploaded_by", user.id)
          .in("tutor_id", Array.from(ids))
          .gte("session_date", start)
          .lt("session_date", nxISO);
        if (delErr) throw delErr;
      }

      const records = cleaned.map((r) => ({
        tutor_id: r.tutor_id,
        agent_name: r.tutor_id,
        team_leader: "",
        session_date: `${r.year}-${String(r.month).padStart(2, "0")}-01`,
        score: r.score,
        uploaded_by: user.id,
        scope: "team",
      }));

      const batchSize = 500;
      for (let i = 0; i < records.length; i += batchSize) {
        const { error: insErr } = await supabase
          .from("quality_uploads")
          .insert(records.slice(i, i + batchSize));
        if (insErr) throw insErr;
      }

      const parts = [`${cleaned.length} record${cleaned.length === 1 ? "" : "s"} uploaded`];
      if (skipped) parts.push(`${skipped} skipped (invalid)`);
      const msg = parts.join(" · ");
      setSuccess(msg);
      toast({ title: "Upload successful", description: msg });
      onUploaded(cleaned.length);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Upload failed.";
      setError(message);
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
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
            <span className="font-medium text-foreground">Employee ID</span>,{" "}
            <span className="font-medium text-foreground">Year</span>,{" "}
            <span className="font-medium text-foreground">Month</span> (1-12),{" "}
            <span className="font-medium text-foreground">Achieved</span> (score % for that month).
            Re-uploading the same tutor + month overwrites the previous entry.
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => fileRef.current?.click()} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </>
              )}
            </Button>
            <Button variant="outline" onClick={downloadTemplate} disabled={submitting}>
              <Download className="w-4 h-4 mr-2" />
              Download template
            </Button>
          </div>

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
