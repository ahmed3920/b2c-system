import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { downloadCsv } from "@/lib/exportCsv";

export interface ExportColumn<T> {
  key: string;
  label: string;
  accessor: (row: T) => unknown;
  defaultOn?: boolean;
}

export interface ExportSelectFilter {
  key: string;
  label: string;
  options: { value: string; label: string }[]; // include an "all" option as first item
  defaultValue?: string;
}

interface Props<T> {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  filenamePrefix: string;
  columns: ExportColumn<T>[];
  /** Selects rendered above the column picker; first option is treated as "all". */
  selectFilters?: ExportSelectFilter[];
  /** True if the row passes the dialog's filters (date range + select values). */
  applyFilters: (
    row: T,
    ctx: { dateFrom: string; dateTo: string; selects: Record<string, string> },
  ) => boolean;
  /** Pre-loaded dataset. If omitted, `loadRows` is invoked when the dialog opens. */
  rows?: T[];
  loadRows?: () => Promise<T[]>;
  /** Label for the date range. Defaults to "Date range". */
  dateLabel?: string;
}

export function ExportDialog<T>({
  open,
  onOpenChange,
  title,
  filenamePrefix,
  columns,
  selectFilters = [],
  applyFilters,
  rows: providedRows,
  loadRows,
  dateLabel = "Date range",
}: Props<T>) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selects, setSelects] = useState<Record<string, string>>(() =>
    Object.fromEntries(selectFilters.map((f) => [f.key, f.defaultValue ?? f.options[0]?.value ?? "all"])),
  );
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.map((c) => [c.key, c.defaultOn ?? true])),
  );
  const [loadedRows, setLoadedRows] = useState<T[] | null>(providedRows ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (providedRows) {
      setLoadedRows(providedRows);
      return;
    }
    if (loadRows) {
      setLoading(true);
      loadRows()
        .then((r) => setLoadedRows(r))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, providedRows]);

  const filtered = useMemo(() => {
    const src = loadedRows ?? [];
    return src.filter((r) => applyFilters(r, { dateFrom, dateTo, selects }));
  }, [loadedRows, dateFrom, dateTo, selects, applyFilters]);

  const handleExport = () => {
    const cols = columns.filter((c) => enabled[c.key]);
    if (cols.length === 0) return;
    const headers = cols.map((c) => c.label);
    const data = filtered.map((row) => cols.map((c) => c.accessor(row)));
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`${filenamePrefix}_${stamp}`, headers, data);
    onOpenChange(false);
  };

  const setAllColumns = (on: boolean) =>
    setEnabled(Object.fromEntries(columns.map((c) => [c.key, on])));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Choose filters and columns. The export contains only rows matching the filters below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{dateLabel} — from</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{dateLabel} — to</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          {selectFilters.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectFilters.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label}</Label>
                  <Select
                    value={selects[f.key] ?? f.options[0]?.value ?? "all"}
                    onValueChange={(v) => setSelects((s) => ({ ...s, [f.key]: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      {f.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Columns</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setAllColumns(true)}>All</Button>
                <Button variant="ghost" size="sm" onClick={() => setAllColumns(false)}>None</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border rounded-md p-3 max-h-[260px] overflow-y-auto">
              {columns.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={!!enabled[c.key]}
                    onCheckedChange={(v) => setEnabled((s) => ({ ...s, [c.key]: !!v }))}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {loading ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</span>
            ) : (
              <>{filtered.length} row(s) match · {columns.filter((c) => enabled[c.key]).length} column(s) selected</>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={loading || filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
