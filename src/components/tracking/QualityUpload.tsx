import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  CalendarIcon,
  CalendarRange,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Strict expected columns. Tutor ID is the canonical identifier (names may change).
const COLUMN_ALIASES: Record<string, string[]> = {
  tutor_id: ["Tutor ID", "Tutor Id", "TutorID", "Mentor ID", "Agent ID"],
  agent_name: ["Agent Name", "Instructor's Name", "Instructor Name", "Mentor", "Tutor Name"],
  team_leader: ["Team Leader"],
  session_date: ["Session Date", "SessionDate", "Date"],
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

interface PendingUpload {
  rows: ParsedRow[];
  skipped: number;
  detectedFrom: Date | null;
  detectedTo: Date | null;
  rowsWithoutDate: number;
  fileName: string;
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
    const utcDays = Math.floor(value - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
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
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { toast } = useToast();

  // Confirmation dialog state
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [confirmFrom, setConfirmFrom] = useState<Date | undefined>(undefined);
  const [confirmTo, setConfirmTo] = useState<Date | undefined>(undefined);
  const [mode, setMode] = useState<"replace" | "append">("replace");

  const handleFile = async (file: File) => {
    setError(null);
    setSuccess(null);
    setParsing(true);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: true,
      });

      if (json.length === 0) throw new Error("The uploaded sheet is empty.");

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
        throw new Error(`Invalid sheet structure. Missing required columns: ${missing.join(", ")}.`);
      }

      const cleaned: ParsedRow[] = [];
      let skipped = 0;
      let rowsWithoutDate = 0;
      let minDate: Date | null = null;
      let maxDate: Date | null = null;

      for (const row of json) {
        const tutorId = String(row[colMap.tutor_id!] ?? "").trim();
        const agent = String(row[colMap.agent_name!] ?? "").trim();
        const tl = String(row[colMap.team_leader!] ?? "").trim();
        const dateRaw = row[colMap.session_date!];
        const scoreRaw = row[colMap.score!];

        if (!tutorId && !agent && !tl && (scoreRaw === "" || scoreRaw == null)) continue;

        const scoreNum =
          typeof scoreRaw === "number" ? scoreRaw : parseFloat(String(scoreRaw).replace("%", "").trim());
        if (!tutorId || !tl || isNaN(scoreNum)) {
          skipped++;
          continue;
        }

        const iso = excelDateToISO(dateRaw);
        if (!iso) {
          // Session Date (column E) is required — skip rows without a valid date.
          rowsWithoutDate++;
          skipped++;
          continue;
        }
        const d = new Date(iso);
        if (!minDate || d < minDate) minDate = d;
        if (!maxDate || d > maxDate) maxDate = d;

        cleaned.push({
          tutor_id: tutorId,
          agent_name: agent || tutorId,
          team_leader: tl,
          session_date: iso,
          score: scoreNum,
        });
      }

      if (cleaned.length === 0) throw new Error("No valid rows found after cleaning.");

      const today = new Date();
      setConfirmFrom(minDate ?? today);
      setConfirmTo(maxDate ?? today);
      setMode("replace");
      setPending({
        rows: cleaned,
        skipped,
        detectedFrom: minDate,
        detectedTo: maxDate,
        rowsWithoutDate,
        fileName: file.name,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Upload failed.";
      setError(message);
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const cancelPending = () => {
    setPending(null);
    setConfirmFrom(undefined);
    setConfirmTo(undefined);
  };

  const confirmUpload = async () => {
    if (!pending) return;
    if (!confirmFrom || !confirmTo) {
      toast({
        title: "Date range required",
        description: "Please confirm the From and To dates for this upload.",
        variant: "destructive",
      });
      return;
    }
    if (confirmFrom > confirmTo) {
      toast({
        title: "Invalid range",
        description: "The 'From' date must be before the 'To' date.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");

      const fromISO = format(confirmFrom, "yyyy-MM-dd");
      const toISO = format(confirmTo, "yyyy-MM-dd");

      // Each row keeps its own session_date from column E ("Session Date").
      // Only rows whose date falls within the confirmed window are uploaded.
      const inRange: ParsedRow[] = [];
      let outOfRange = 0;
      for (const r of pending.rows) {
        if (!r.session_date) {
          outOfRange++;
          continue;
        }
        if (r.session_date >= fromISO && r.session_date <= toISO) {
          inRange.push(r);
        } else {
          outOfRange++;
        }
      }

      if (inRange.length === 0) {
        throw new Error("No rows fall within the confirmed date range.");
      }

      if (mode === "replace") {
        // Replace this user's data within the confirmed window only.
        const { error: delErr } = await supabase
          .from("quality_uploads")
          .delete()
          .eq("uploaded_by", user.id)
          .gte("session_date", fromISO)
          .lte("session_date", toISO);
        if (delErr) throw delErr;
      }

      const records = inRange.map((r) => ({ ...r, uploaded_by: user.id }));
      const batchSize = 500;
      for (let i = 0; i < records.length; i += batchSize) {
        const { error: insErr } = await supabase
          .from("quality_uploads")
          .insert(records.slice(i, i + batchSize));
        if (insErr) throw insErr;
      }

      const parts = [
        `${inRange.length} record${inRange.length === 1 ? "" : "s"} added`,
        `(${format(confirmFrom, "PP")} → ${format(confirmTo, "PP")})`,
      ];
      if (outOfRange) parts.push(`${outOfRange} skipped (outside range)`);
      if (pending.skipped) parts.push(`${pending.skipped} skipped (invalid)`);
      const msg = parts.join(" · ");

      setSuccess(msg);
      toast({ title: "Upload successful", description: msg });
      onUploaded(inRange.length);
      cancelPending();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Upload failed.";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
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
              <span className="font-medium text-foreground">Session Date</span>. After choosing a
              file you'll confirm which date range the data covers.
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
            <Button onClick={() => fileRef.current?.click()} disabled={parsing || submitting}>
              {parsing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Reading file...
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

      <Dialog open={!!pending} onOpenChange={(o) => !o && !submitting && cancelPending()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarRange className="w-5 h-5" /> Confirm date range
            </DialogTitle>
            <DialogDescription>
              Please confirm the period this upload covers. The data will be added to your existing
              records for the selected date range.
            </DialogDescription>
          </DialogHeader>

          {pending && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/30 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">File</span>
                  <span className="font-medium truncate ml-3">{pending.fileName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valid records</span>
                  <Badge variant="secondary">{pending.rows.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Detected range in file</span>
                  <span className="font-medium">
                    {pending.detectedFrom && pending.detectedTo
                      ? `${format(pending.detectedFrom, "PP")} → ${format(pending.detectedTo, "PP")}`
                      : "No dates found"}
                  </span>
                </div>
                {pending.rowsWithoutDate > 0 && (
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                    <span>Rows without a date</span>
                    <span className="font-medium">{pending.rowsWithoutDate}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">From</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !confirmFrom && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {confirmFrom ? format(confirmFrom, "PP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={confirmFrom}
                        onSelect={setConfirmFrom}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">To</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !confirmTo && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {confirmTo ? format(confirmTo, "PP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={confirmTo}
                        onSelect={setConfirmTo}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  How to handle existing data in this range
                </label>
                <Select value={mode} onValueChange={(v) => setMode(v as "replace" | "append")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replace">
                      Replace my existing data within this range
                    </SelectItem>
                    <SelectItem value="append">Append to existing data</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {mode === "replace"
                    ? "Your previous uploads inside the selected range will be removed and replaced."
                    : "New records will be added on top of any existing records in this range."}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={cancelPending} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={confirmUpload} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...
                </>
              ) : (
                <>Confirm & Upload</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
