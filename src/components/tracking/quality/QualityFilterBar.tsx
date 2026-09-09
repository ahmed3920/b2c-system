import { useState } from "react";
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
import { FLAG_FILTER_OPTIONS } from "@/lib/qualityFlags";
import { useQualityScope } from "@/hooks/useQualityScope";
import { Badge } from "@/components/ui/badge";

const ALL = "all";

/** Select dropdown with a search box to filter long option lists. */
export function SearchableSelect({
  value,
  onChange,
  options,
  allLabel,
  placeholder = "All",
  labelFn,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel: string;
  placeholder?: string;
  labelFn?: (v: string) => string;
}) {
  const [search, setSearch] = useState("");
  const label = labelFn ?? ((v: string) => v);
  const filtered = options.filter((o) => label(o).toLowerCase().includes(search.trim().toLowerCase()));
  // Keep the currently selected value visible even if it doesn't match the search.
  const items = value && !filtered.includes(value) ? [value, ...filtered] : filtered;
  return (
    <Select value={value || ALL} onValueChange={(v) => { onChange(v === ALL ? "" : v); setSearch(""); }}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent className="max-h-72">
        <div className="p-1 sticky top-0 bg-popover z-10">
          <Input
            autoFocus
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-8"
          />
        </div>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {items.map((o) => (
          <SelectItem key={o} value={o}>{label(o)}</SelectItem>
        ))}
        {items.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground text-center">No matches</p>
        )}
      </SelectContent>
    </Select>
  );
}

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
  const scope = useQualityScope();
  const locked = scope.lockedTeamLead || scope.lockedMentor;
  const show = (k: keyof QualityFilters) => !hide.includes(k) && !(k === "team_lead" && !!locked);
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-base">Filters</CardTitle>
          {locked && (
            <Badge variant="secondary" className="font-normal">
              {scope.lockedTeamLead ? "Team" : "Mentor"}: {scope.displayName ?? locked}
            </Badge>
          )}
        </div>
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
            <SearchableSelect
              value={filters.team_lead}
              onChange={(v) => update({ team_lead: v })}
              options={options?.team_leaders ?? []}
              allLabel="All team leaders"
            />
          </Field>
        )}
        {show("tutor") && (
          <Field label="Tutor name or T-ID">
            <Input placeholder="e.g. T-4602" value={filters.tutor} onChange={(e) => update({ tutor: e.target.value })} />
          </Field>
        )}
        {show("student") && (
          <Field label="Student ID or name">
            <Input placeholder="e.g. S-84438" value={filters.student} onChange={(e) => update({ student: e.target.value })} />
          </Field>
        )}
        {show("organization") && (
          <Field label="Organization">
            <SearchableSelect
              value={filters.organization}
              onChange={(v) => update({ organization: v })}
              options={options?.organizations ?? []}
              allLabel="All organizations"
            />
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
            <SearchableSelect
              value={filters.review_cycle}
              onChange={(v) => update({ review_cycle: v })}
              options={(options?.review_cycles ?? []).map(String)}
              allLabel="All cycles"
              labelFn={cycleLabel}
            />
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
        {show("flag") && (
          <Field label="Flag">
            <Select value={filters.flag || ALL} onValueChange={(v) => update({ flag: v === ALL ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any</SelectItem>
                {FLAG_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
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
