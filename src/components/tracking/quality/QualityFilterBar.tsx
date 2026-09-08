import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, X } from "lucide-react";
import type { QualityFilters, QualityFilterOptions } from "@/hooks/useQualityReviews";
import { TUTOR_STATUS_OPTIONS, cycleLabel } from "@/lib/tutorStatus";

const ALL = "all";

type Props = {
  filters: QualityFilters;
  update: (patch: Partial<QualityFilters>) => void;
  reset: () => void;
  options?: QualityFilterOptions;
  onRefresh?: () => void;
  loading?: boolean;
  actions?: React.ReactNode;
  /** Hide filters that don't apply to a given tab. */
  hide?: (keyof QualityFilters)[];
  children?: React.ReactNode;
};

/** Shared filter card used by every Quality tab (same filter set everywhere). */
export function QualityFilterBar({
  filters,
  update,
  reset,
  options,
  onRefresh,
  loading,
  actions,
  hide = [],
  children,
}: Props) {
  const show = (k: keyof QualityFilters) => !hide.includes(k);
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Filters</CardTitle>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button size="sm" variant="ghost" onClick={reset}>
            <X className="w-3.5 h-3.5 mr-1.5" /> Clear
          </Button>
          {onRefresh && (
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Refresh
            </Button>
          )}
          {actions}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {show("date_from") && (
          <Field label="From">
            <Input type="date" value={filters.date_from} onChange={(e) => update({ date_from: e.target.value })} />
          </Field>
        )}
        {show("date_to") && (
          <Field label="To">
            <Input type="date" value={filters.date_to} onChange={(e) => update({ date_to: e.target.value })} />
          </Field>
        )}
        {show("team_lead") && (
          <Field label="Team leader">
            <Select value={filters.team_lead || ALL} onValueChange={(v) => update({ team_lead: v === ALL ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ALL}>All team leaders</SelectItem>
                {(options?.team_leaders ?? []).map((tl) => (
                  <SelectItem key={tl} value={tl}>{tl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {show("tutor") && (
          <Field label="Tutor name or T-ID">
            <Input placeholder="e.g. T-4602" value={filters.tutor} onChange={(e) => update({ tutor: e.target.value })} />
          </Field>
        )}
        {show("organization") && (
          <Field label="Organization">
            <Select value={filters.organization || ALL} onValueChange={(v) => update({ organization: v === ALL ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ALL}>All organizations</SelectItem>
                {(options?.organizations ?? []).map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {show("tutor_status") && (
          <Field label="Tutor status">
            <Select value={filters.tutor_status || ALL} onValueChange={(v) => update({ tutor_status: v === ALL ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {TUTOR_STATUS_OPTIONS.filter(
                  (o) => !options?.tutor_statuses || options.tutor_statuses.includes(Number(o.value)) || o.value === filters.tutor_status,
                ).map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {show("session_type") && (
          <Field label="Session type">
            <Select value={filters.session_type || ALL} onValueChange={(v) => update({ session_type: v === ALL ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {(options?.session_types ?? []).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {show("review_cycle") && (
          <Field label="Review cycle">
            <Select value={filters.review_cycle || ALL} onValueChange={(v) => update({ review_cycle: v === ALL ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ALL}>All cycles</SelectItem>
                {(options?.review_cycles ?? []).map((c) => (
                  <SelectItem key={c} value={c}>{cycleLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {show("status") && (
          <Field label="Review status">
            <Select value={filters.status || ALL} onValueChange={(v) => update({ status: v === ALL ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="1">Submitted</SelectItem>
                <SelectItem value="0">Pending</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
        {show("min_score") && (
          <Field label="Min score">
            <Input type="number" step="0.1" min={0} max={5} value={filters.min_score} onChange={(e) => update({ min_score: e.target.value })} />
          </Field>
        )}
        {show("max_score") && (
          <Field label="Max score">
            <Input type="number" step="0.1" min={0} max={5} value={filters.max_score} onChange={(e) => update({ max_score: e.target.value })} />
          </Field>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function Kpi({ label, value, loading, hint }: { label: string; value: string; loading?: boolean; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{loading ? "…" : value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return false;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
