import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, Save, X } from "lucide-react";
import { Field, Kpi, SearchableSelect } from "./QualityFilterBar";
import { cycleLabel } from "@/lib/tutorStatus";
import { toast } from "@/hooks/use-toast";
import {
  useQualityFlagFollowups,
  FOLLOWUP_STATUS_LABEL,
  FLAG_PAGE_SIZE,
  type FollowupStatus,
  type FlagRow,
} from "@/hooks/useQualityFlagFollowups";

const ALL = "all";

function NoteCell({
  row,
  value,
  onSave,
  saving,
}: {
  row: FlagRow;
  value: string;
  onSave: (note: string) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [touched, setTouched] = useState(false);
  const current = touched ? draft : value;
  return (
    <div className="space-y-1 min-w-[220px]">
      <Textarea
        rows={2}
        placeholder="Action taken…"
        value={current}
        onChange={(e) => {
          setTouched(true);
          setDraft(e.target.value);
        }}
        className="text-sm"
      />
      {touched && current !== value && (
        <Button
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() => {
            onSave(current);
            setTouched(false);
          }}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5 mr-1.5" />
          )}
          Save note
        </Button>
      )}
    </div>
  );
}

/** Red / yellow flags with a status + note so team leaders can track action. */
export function QualityFlagFollowupTab() {
  const f = useQualityFlagFollowups();
  const t = f.totals;
  const total = f.filters.flag_type === "2" ? (t?.red ?? 0) : f.filters.flag_type === "1" ? (t?.yellow ?? 0) : (t?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / FLAG_PAGE_SIZE));
  const locked = f.scope.lockedTeamLead || f.scope.lockedMentor;

  const handleSave = async (row: FlagRow, patch: { status?: FollowupStatus; note?: string }) => {
    const err = await f.save(row, patch);
    if (err) toast({ title: "Could not save", description: err, variant: "destructive" });
    else toast({ title: "Follow-up saved" });
  };

  const statusCounts = f.allRows.reduce(
    (acc, r) => {
      const s = f.followups[r.flag_id]?.status ?? "open";
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Red flags" value={(t?.red ?? 0).toLocaleString()} />
        <Kpi label="Yellow flags" value={(t?.yellow ?? 0).toLocaleString()} />
        <Kpi label="Tutors flagged" value={(t?.tutors ?? 0).toLocaleString()} />
        <Kpi
          label="Handled on this page"
          value={`${statusCounts.done ?? 0}/${f.allRows.length}`}
          hint={`${statusCounts.in_progress ?? 0} in progress`}
        />
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">Filters</CardTitle>
            {locked && (
              <Badge variant="secondary" className="font-normal">
                {f.scope.lockedTeamLead ? "Team" : "Mentor"}: {f.scope.displayName ?? locked}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={f.reset}>
              <X className="w-3.5 h-3.5 mr-1.5" /> Clear
            </Button>
            <Button size="sm" variant="outline" onClick={f.refetch} disabled={f.loading}>
              {f.loading ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Review cycle">
            <SearchableSelect
              value={f.filters.cycle}
              onChange={(v) => f.update({ cycle: v })}
              options={f.cycles}
              allLabel="All cycles"
              labelFn={cycleLabel}
            />
          </Field>
          <Field label="Flag">
            <Select
              value={f.filters.flag_type || ALL}
              onValueChange={(v) => f.update({ flag_type: v === ALL ? "" : (v as "1" | "2") })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Red flags</SelectItem>
                <SelectItem value="1">Yellow flags</SelectItem>
                <SelectItem value={ALL}>All flags</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Follow-up status">
            <Select
              value={f.filters.followup}
              onValueChange={(v) => f.update({ followup: v as FollowupStatus | "all" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tutor name or T-ID">
            <Input
              placeholder="e.g. T-4602"
              value={f.filters.tutor}
              onChange={(e) => f.update({ tutor: e.target.value })}
            />
          </Field>
          {!locked && (
            <Field label="Team leader">
              <SearchableSelect
                value={f.filters.team_lead}
                onChange={(v) => f.update({ team_lead: v })}
                options={f.options?.team_leaders ?? []}
                allLabel="All team leaders"
              />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Flag follow-up{" "}
            <span className="text-sm font-normal text-muted-foreground">
              showing {f.rows.length} of {total.toLocaleString()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {f.error ? (
            <p className="text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" /> {f.error}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tutor</TableHead>
                      <TableHead>Team leader</TableHead>
                      <TableHead>Session</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Flag</TableHead>
                      <TableHead className="w-[150px]">Status</TableHead>
                      <TableHead>Action taken</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {f.loading && f.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Loading flags…
                        </TableCell>
                      </TableRow>
                    ) : f.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No flags match these filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      f.rows.map((r) => {
                        const fu = f.followups[r.flag_id];
                        return (
                          <TableRow key={r.flag_id}>
                            <TableCell>
                              {r.tutor_name}
                              <span className="block text-xs text-muted-foreground">{r.tutor_tid}</span>
                            </TableCell>
                            <TableCell className="text-sm">{r.team_leader ?? "—"}</TableCell>
                            <TableCell className="text-sm">
                              {r.session_start_at
                                ? new Date(r.session_start_at).toLocaleDateString()
                                : "—"}
                              <span className="block text-xs text-muted-foreground">
                                {r.review_cycle ? cycleLabel(r.review_cycle) : ""}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {r.score != null ? `${Number(r.score).toFixed(2)}` : "—"}
                              <span className="block text-xs text-muted-foreground">
                                {r.score_pct ? `${r.score_pct}%` : ""}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              <Badge
                                className={
                                  r.flag_color === "red"
                                    ? "bg-destructive text-destructive-foreground"
                                    : "bg-warning text-warning-foreground"
                                }
                              >
                                {r.flag_color === "red" ? "Red" : "Yellow"}
                              </Badge>
                              <span className="block text-xs mt-1">
                                {r.parent_name ?? r.criterion_name ?? "—"}
                                {r.criterion_name && r.parent_name ? ` · ${r.criterion_name}` : ""}
                              </span>
                              {r.description && (
                                <span className="block text-xs text-muted-foreground">
                                  {r.description}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={fu?.status ?? "open"}
                                onValueChange={(v) => handleSave(r, { status: v as FollowupStatus })}
                              >
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(FOLLOWUP_STATUS_LABEL) as FollowupStatus[]).map((s) => (
                                    <SelectItem key={s} value={s}>{FOLLOWUP_STATUS_LABEL[s]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {fu?.updated_at && (
                                <span className="block text-[11px] text-muted-foreground mt-1">
                                  {new Date(fu.updated_at).toLocaleDateString()}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <NoteCell
                                row={r}
                                value={fu?.note ?? ""}
                                saving={f.saving === r.flag_id}
                                onSave={(note) => handleSave(r, { note })}
                              />
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" asChild>
                                <a href={`/performance?tab=quality&review=${r.review_id}`}>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-3 text-sm">
                <span className="text-muted-foreground">Page {f.page + 1} of {pages}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={f.page === 0 || f.loading}
                    onClick={() => f.setPage(f.page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={f.page + 1 >= pages || f.loading}
                    onClick={() => f.setPage(f.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
