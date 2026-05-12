import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { tutorRoster } from "@/data/tutorRoster";

type Row = {
  id: string;
  name: string;
  team_leader: string;
  mentor: string;
  ranking: string;
  phone: string;
  role: string;
  language: string;
  employment_type: string;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}

const HEADER_MAP: Record<string, keyof Row> = {
  "T ID": "id",
  "Name I18n → En": "name",
  "Admins - Team Lead → Name": "team_leader",
  "Admins - Mentor → Name": "mentor",
  "Rankings → Name": "ranking",
  Phone: "phone",
  IsMentor: "role",
  "Tutor Language": "language",
  "Employment Type": "employment_type",
};

function normalize(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s).trim();
}

export function UploadRosterDialog({ open, onOpenChange, onDone }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<{
    rows: Row[];
    changed: Row[];
    added: Row[];
    missing: { id: string; name: string; team_leader: string; is_mentor: boolean }[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const reset = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setParsing(true);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const rows: Row[] = json.map((r) => {
        const out: Partial<Row> = {};
        for (const [k, v] of Object.entries(r)) {
          const key = HEADER_MAP[k.trim()];
          if (key) out[key] = normalize(v);
        }
        // Employment type may come as 0/1 numeric
        if (out.employment_type === "0" || out.employment_type === "") out.employment_type = "Full-time";
        else if (out.employment_type === "1") out.employment_type = "Part-time";
        return {
          id: out.id ?? "",
          name: out.name ?? "",
          team_leader: out.team_leader ?? "",
          mentor: out.mentor ?? "",
          ranking: out.ranking ?? "",
          phone: out.phone ?? "",
          role: out.role || "Tutor",
          language: out.language ?? "",
          employment_type: out.employment_type ?? "Full-time",
        };
      }).filter((r) => r.id);

      // Compare with existing baseline (static + overrides loaded fresh)
      const { data: ovRows } = await supabase.from("tutor_roster_overrides").select("*");
      const overrides = ovRows ?? [];
      const existing = new Map<string, Row>();
      for (const t of tutorRoster) {
        existing.set(t.id, {
          id: t.id, name: t.name, team_leader: t.team_leader, mentor: t.mentor,
          ranking: t.ranking, phone: t.phone, role: t.role, language: t.language, employment_type: t.employment_type,
        });
      }
      for (const o of overrides) {
        const cur = existing.get(o.tutor_external_id) ?? { id: o.tutor_external_id, name: o.name, team_leader: "", mentor: "", ranking: "", phone: "", role: "Tutor", language: "", employment_type: "Full-time" };
        existing.set(o.tutor_external_id, {
          ...cur,
          name: o.name || cur.name,
          team_leader: o.team_leader ?? cur.team_leader,
          mentor: o.mentor ?? cur.mentor,
          ranking: o.ranking ?? cur.ranking,
          phone: o.phone ?? cur.phone,
          role: o.role ?? cur.role,
          language: o.language ?? cur.language,
          employment_type: o.employment_type ?? cur.employment_type,
        });
      }

      const incomingIds = new Set(rows.map((r) => r.id));
      const changed: Row[] = [];
      const added: Row[] = [];
      for (const r of rows) {
        const cur = existing.get(r.id);
        if (!cur) added.push(r);
        else if (
          cur.name !== r.name || cur.team_leader !== r.team_leader || cur.mentor !== r.mentor ||
          cur.ranking !== r.ranking || cur.phone !== r.phone || cur.role !== r.role ||
          cur.language !== r.language || cur.employment_type !== r.employment_type
        ) {
          changed.push(r);
        }
      }
      const missing: { id: string; name: string; team_leader: string; is_mentor: boolean }[] = [];
      for (const t of existing.values()) {
        if (!incomingIds.has(t.id)) {
          missing.push({ id: t.id, name: t.name, team_leader: t.team_leader, is_mentor: t.role === "Mentor" });
        }
      }
      setPreview({ rows, changed, added, missing });
    } catch (e) {
      toast({ title: "Failed to parse file", description: (e as Error).message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const apply = async () => {
    if (!preview) return;
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;
      let userName: string | null = null;
      if (userId) {
        const { data: prof } = await supabase
          .from("profiles").select("full_name, mentor_name").eq("user_id", userId).maybeSingle();
        userName = prof?.full_name ?? prof?.mentor_name ?? null;
      }

      // 1) Upsert overrides for changed and new rows
      const upserts = [
        ...preview.changed.map((r) => ({
          tutor_external_id: r.id, name: r.name, team_leader: r.team_leader, mentor: r.mentor,
          ranking: r.ranking, phone: r.phone, role: r.role, language: r.language, employment_type: r.employment_type,
          is_new: false, updated_by: userId, updated_by_name: userName,
        })),
        ...preview.added.map((r) => ({
          tutor_external_id: r.id, name: r.name, team_leader: r.team_leader, mentor: r.mentor,
          ranking: r.ranking, phone: r.phone, role: r.role, language: r.language, employment_type: r.employment_type,
          is_new: true, updated_by: userId, updated_by_name: userName,
        })),
      ];
      if (upserts.length) {
        const { error } = await supabase.from("tutor_roster_overrides").upsert(upserts, { onConflict: "tutor_external_id" });
        if (error) throw error;
      }

      // 2) Mark missing tutors as resigned in tutor_status (preserve existing terminated)
      const today = new Date().toISOString().slice(0, 10);
      if (preview.missing.length) {
        const { data: existingStatus } = await supabase
          .from("tutor_status")
          .select("tutor_external_id,status")
          .in("tutor_external_id", preview.missing.map((m) => m.id));
        const skip = new Set((existingStatus ?? []).filter((s) => s.status !== "active").map((s) => s.tutor_external_id));
        const statusRows = preview.missing
          .filter((m) => !skip.has(m.id))
          .map((m) => ({
            tutor_external_id: m.id, tutor_name: m.name, team_leader: m.team_leader, is_mentor: m.is_mentor,
            status: "resigned", effective_date: today,
            notes: "Auto-marked from roster sheet upload (not present in latest sheet).",
            set_by: userId, set_by_name: userName,
          }));
        if (statusRows.length) {
          const { error } = await supabase.from("tutor_status").upsert(statusRows, { onConflict: "tutor_external_id" });
          if (error) throw error;
        }

        // Re-activate tutors that came back in the sheet (currently resigned)
        const incomingIds = preview.rows.map((r) => r.id);
        if (incomingIds.length) {
          const { data: comebacks } = await supabase
            .from("tutor_status")
            .select("tutor_external_id,status")
            .in("tutor_external_id", incomingIds)
            .eq("status", "resigned");
          if (comebacks?.length) {
            const reactivate = comebacks.map((c) => {
              const r = preview.rows.find((x) => x.id === c.tutor_external_id)!;
              return {
                tutor_external_id: r.id, tutor_name: r.name, team_leader: r.team_leader,
                is_mentor: r.role === "Mentor", status: "active", effective_date: null,
                notes: "Reactivated from roster sheet upload.", set_by: userId, set_by_name: userName,
              };
            });
            await supabase.from("tutor_status").upsert(reactivate, { onConflict: "tutor_external_id" });
          }
        }
      }

      toast({
        title: "Roster updated",
        description: `${preview.changed.length} updated · ${preview.added.length} added · ${preview.missing.length} marked resigned`,
      });
      onDone();
      onOpenChange(false);
      reset();
    } catch (e) {
      toast({ title: "Update failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Upload Roster Sheet
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file with the latest tutor list. Tutors no longer in the sheet will be
            marked <span className="font-medium">resigned</span>. Mentor and team-leader assignment
            changes will be applied automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-md p-6 text-center">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {!file ? (
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Select Excel file
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">{file.name}</p>
                <Button type="button" size="sm" variant="ghost" onClick={reset}>Choose different file</Button>
              </div>
            )}
            {parsing && <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Parsing…</p>}
          </div>

          {preview && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <SummaryBox icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Updated" value={preview.changed.length} />
                <SummaryBox icon={<CheckCircle2 className="h-4 w-4 text-blue-600" />} label="New" value={preview.added.length} />
                <SummaryBox icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} label="Resigned" value={preview.missing.length} />
              </div>

              {preview.missing.length > 0 && (
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-xs font-medium">Will be marked resigned ({preview.missing.length})</summary>
                  <ul className="mt-2 max-h-40 overflow-y-auto text-xs space-y-1">
                    {preview.missing.slice(0, 200).map((m) => (
                      <li key={m.id} className="flex justify-between">
                        <span>{m.name}</span><span className="font-mono text-muted-foreground">{m.id}</span>
                      </li>
                    ))}
                    {preview.missing.length > 200 && <li className="text-muted-foreground">…and {preview.missing.length - 200} more</li>}
                  </ul>
                </details>
              )}
              {preview.changed.length > 0 && (
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-xs font-medium">Will be updated ({preview.changed.length})</summary>
                  <ul className="mt-2 max-h-40 overflow-y-auto text-xs space-y-1">
                    {preview.changed.slice(0, 200).map((m) => (
                      <li key={m.id} className="flex justify-between">
                        <span>{m.name} — TL: {m.team_leader} · Mentor: {m.mentor}</span><span className="font-mono text-muted-foreground">{m.id}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!preview || submitting} onClick={apply}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
