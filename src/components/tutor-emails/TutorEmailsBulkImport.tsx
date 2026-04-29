import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}

interface ParsedRow {
  tutor_external_id: string;
  tutor_name: string;
  email: string;
  status: "active";
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (k: string) => headers.indexOf(k);
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    if (cells.every((c) => !c)) continue;
    const tutor_external_id =
      (idx("tutor_id") >= 0 ? cells[idx("tutor_id")] : "") ||
      (idx("id") >= 0 ? cells[idx("id")] : "") ||
      (idx("tutor_external_id") >= 0 ? cells[idx("tutor_external_id")] : "") ||
      "";
    const tutor_name =
      (idx("tutor_name") >= 0 ? cells[idx("tutor_name")] : "") ||
      (idx("name") >= 0 ? cells[idx("name")] : "") ||
      "";
    const email = idx("email") >= 0 ? cells[idx("email")] || "" : "";
    if (!tutor_external_id || !email) continue;
    rows.push({ tutor_external_id, tutor_name, email, status: "active" });
  }
  return rows;
}

export function TutorEmailsBulkImport({ open, onOpenChange, onImported }: Props) {
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsv(text);
  };

  const handleImport = async () => {
    const rows = parseCsv(csv);
    if (rows.length === 0) {
      toast.error("No valid rows found", { description: "Headers required: tutor_id,tutor_name,email,status,team_leader,notes" });
      return;
    }
    setImporting(true);
    const { error } = await supabase
      .from("tutor_emails")
      .upsert(rows, { onConflict: "tutor_external_id" });
    setImporting(false);
    if (error) {
      toast.error("Import failed", { description: error.message });
      return;
    }
    toast.success(`Imported ${rows.length} email(s)`);
    setCsv("");
    onImported();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Tutor Emails</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload a CSV with headers: <code>tutor_id,tutor_name,email,status,team_leader,notes</code>.
            Existing rows (matched by tutor_id) will be updated.
          </p>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Upload CSV file
            </Button>
          </div>
          <div>
            <Label>Or paste CSV</Label>
            <Textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={10}
              placeholder="tutor_id,tutor_name,email,status,team_leader,notes&#10;T123,John Doe,john@example.com,active,Jane TL,"
              className="font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>Cancel</Button>
          <Button onClick={handleImport} disabled={importing || !csv.trim()}>
            {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
