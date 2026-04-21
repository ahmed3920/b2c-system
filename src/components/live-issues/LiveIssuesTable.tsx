import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Database, History, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useEduDescriptions } from "@/hooks/useEduDescriptions";
import { EduValidationBadge, type EduValidation } from "./EduValidationBadge";
import { IssueAuditDialog } from "./IssueAuditDialog";
import { LiveIssuesSyncCard } from "./LiveIssuesSyncCard";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";

interface IssueRow {
  id: string;
  case_id: string;
  session_id: string | null;
  session_date: string | null;
  from_tutor_id: string | null;
  from_tutor_name: string | null;
  team_leader: string | null;
  issue_reason: string | null;
  issue_details: string | null;
  edu_validation: EduValidation;
  edu_description_id: string | null;
  edu_notes: string | null;
  language: string | null;
  class_type: string | null;
  last_synced_at: string;
  updated_at: string;
}

const PAGE_SIZE = 25;
const ALL = "__all__";

export function LiveIssuesTable() {
  const { isAdmin, isTeamLeader } = useUserRole();
  const canEdit = isAdmin || isTeamLeader;
  const { items: descriptions } = useEduDescriptions(false);
  const descById = useMemo(
    () => Object.fromEntries(descriptions.map((d) => [d.id, d])),
    [descriptions],
  );

  const [rows, setRows] = useState<IssueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [teamLeader, setTeamLeader] = useState<string>(ALL);
  const [issueType, setIssueType] = useState<string>(ALL);
  const [validation, setValidation] = useState<string>(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Audit
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditIssue, setAuditIssue] = useState<{ id: string; case_id: string } | null>(null);

  // Distinct filter options (from current page-agnostic small query)
  const [issueTypes, setIssueTypes] = useState<string[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<string[]>([]);

  const loadFilters = useCallback(async () => {
    const { data } = await supabase
      .from("live_session_issues")
      .select("issue_reason, team_leader")
      .limit(1000);
    if (data) {
      setIssueTypes(Array.from(new Set(data.map((r) => r.issue_reason).filter(Boolean) as string[])).sort());
      setTeamLeaders(Array.from(new Set(data.map((r) => r.team_leader).filter(Boolean) as string[])).sort());
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("live_session_issues")
      .select(
        "id, case_id, session_id, session_date, from_tutor_id, from_tutor_name, team_leader, issue_reason, issue_details, edu_validation, edu_description_id, edu_notes, language, class_type, last_synced_at, updated_at",
        { count: "exact" },
      )
      .order("session_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (tutorId.trim()) q = q.ilike("from_tutor_id", `%${tutorId.trim()}%`);
    if (teamLeader !== ALL) q = q.eq("team_leader", teamLeader);
    if (issueType !== ALL) q = q.eq("issue_reason", issueType);
    if (validation !== ALL) {
      if (validation === "__none__") q = q.is("edu_validation", null);
      else q = q.eq("edu_validation", validation as "deduct" | "no_deduction" | "pending");
    }
    if (dateFrom) q = q.gte("session_date", dateFrom);
    if (dateTo) q = q.lte("session_date", dateTo);
    if (search.trim()) {
      const s = search.trim();
      q = q.or(`case_id.ilike.%${s}%,from_tutor_name.ilike.%${s}%,issue_details.ilike.%${s}%,session_id.ilike.%${s}%`);
    }

    const from = page * PAGE_SIZE;
    q = q.range(from, from + PAGE_SIZE - 1);

    const { data, error, count } = await q;
    if (error) {
      toast.error(error.message);
      setRows([]);
      setTotal(0);
    } else {
      setRows((data ?? []) as IssueRow[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [tutorId, teamLeader, issueType, validation, dateFrom, dateTo, search, page]);

  useEffect(() => { loadFilters(); }, [loadFilters]);
  useEffect(() => { load(); }, [load]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [tutorId, teamLeader, issueType, validation, dateFrom, dateTo, search]);

  const writeAudit = async (
    row: IssueRow,
    field: string,
    oldVal: string | null,
    newVal: string | null,
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, mentor_name")
      .eq("user_id", user.id)
      .maybeSingle();
    await supabase.from("live_session_issue_audit").insert({
      issue_id: row.id,
      case_id: row.case_id,
      changed_by: user.id,
      changed_by_name: profile?.full_name ?? profile?.mentor_name ?? user.email ?? null,
      field_name: field,
      old_value: oldVal,
      new_value: newVal,
    });
  };

  const updateRow = async (
    row: IssueRow,
    patch: Partial<Pick<IssueRow, "edu_validation" | "edu_description_id" | "edu_notes">>,
    auditFields: { field: string; oldVal: string | null; newVal: string | null }[],
  ) => {
    setSavingId(row.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("live_session_issues")
      .update({ ...patch, updated_by: user?.id ?? null })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      setSavingId(null);
      return;
    }
    for (const a of auditFields) await writeAudit(row, a.field, a.oldVal, a.newVal);
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    setSavingId(null);
    toast.success("Saved");
  };

  const handleValidationChange = (row: IssueRow, value: string) => {
    const newVal = value === "__clear__" ? null : (value as "deduct" | "no_deduction" | "pending");
    updateRow(row, { edu_validation: newVal }, [
      { field: "edu_validation", oldVal: row.edu_validation ?? null, newVal },
    ]);
  };

  const handleDescriptionChange = (row: IssueRow, value: string) => {
    const newId = value === "__clear__" ? null : value;
    const desc = newId ? descById[newId] : null;
    const patch: Partial<IssueRow> = { edu_description_id: newId };
    const audits = [{
      field: "edu_description_id",
      oldVal: row.edu_description_id,
      newVal: newId,
    }];
    // Smart linking: auto-set validation based on type unless user already set it manually
    if (desc) {
      if (desc.type === "deduction" && row.edu_validation !== "deduct") {
        patch.edu_validation = "deduct";
        audits.push({ field: "edu_validation", oldVal: row.edu_validation ?? null, newVal: "deduct" });
      } else if (desc.type === "no_deduction" && row.edu_validation !== "no_deduction") {
        patch.edu_validation = "no_deduction";
        audits.push({ field: "edu_validation", oldVal: row.edu_validation ?? null, newVal: "no_deduction" });
      }
    }
    updateRow(row, patch, audits);
  };

  const finalDecision = (row: IssueRow): { label: string; overridden: boolean } => {
    if (row.edu_validation) {
      const map: Record<string, string> = { deduct: "Deduct", no_deduction: "No Deduction", pending: "Pending" };
      return { label: map[row.edu_validation], overridden: true };
    }
    return { label: "—", overridden: false };
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <LiveIssuesSyncCard isAdmin={isAdmin} onSynced={() => { load(); loadFilters(); }} />

      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Case, tutor, details..."
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Tutor ID</Label>
              <Input value={tutorId} onChange={(e) => setTutorId(e.target.value)} placeholder="T-1234" />
            </div>
            <div>
              <Label className="text-xs">Issue Type</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {issueTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Edu Validation</Label>
              <Select value={validation} onValueChange={setValidation}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="__none__">Not validated</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="deduct">Deduct</SelectItem>
                  <SelectItem value="no_deduction">No Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date from</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Date to</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSearch(""); setTutorId(""); setIssueType(ALL);
                  setValidation(ALL); setDateFrom(""); setDateTo("");
                }}
              >
                Clear filters
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 cursor-help">
                  <Database className="h-3 w-3" /> Synced columns are read-only.
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Data synced from moderation sheet. Edu fields override final decision.
              </TooltipContent>
            </Tooltip>
            <span className="ml-3">{total} case(s)</span>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Team Leader</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Issue Details</TableHead>
                  <TableHead className="bg-amber-50/50 dark:bg-amber-950/10">Edu Validation</TableHead>
                  <TableHead className="bg-amber-50/50 dark:bg-amber-950/10">Edu Description</TableHead>
                  <TableHead>Final</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="h-24 text-center">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    No cases. Sync the moderation sheet to load data.
                  </TableCell></TableRow>
                ) : rows.map((row) => {
                  const fd = finalDecision(row);
                  const desc = row.edu_description_id ? descById[row.edu_description_id] : null;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs max-w-[160px] truncate" title={row.case_id}>
                        {row.case_id}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {row.session_date ? format(new Date(row.session_date), "PP") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{row.from_tutor_name || "—"}</div>
                        <div className="text-muted-foreground">{row.from_tutor_id}</div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{row.team_leader || "—"}</TableCell>
                      <TableCell className="text-xs">{row.issue_reason || "—"}</TableCell>
                      <TableCell className="text-xs max-w-[280px]">
                        <div className="line-clamp-3 whitespace-pre-wrap" title={row.issue_details ?? ""}>
                          {row.issue_details || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="bg-amber-50/50 dark:bg-amber-950/10">
                        {canEdit ? (
                          <Select
                            value={row.edu_validation ?? "__clear__"}
                            onValueChange={(v) => handleValidationChange(row, v)}
                            disabled={savingId === row.id}
                          >
                            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__clear__">— None —</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="deduct">Deduct</SelectItem>
                              <SelectItem value="no_deduction">No Deduction</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <EduValidationBadge value={row.edu_validation} />
                        )}
                      </TableCell>
                      <TableCell className="bg-amber-50/50 dark:bg-amber-950/10">
                        {canEdit ? (
                          <Select
                            value={row.edu_description_id ?? "__clear__"}
                            onValueChange={(v) => handleDescriptionChange(row, v)}
                            disabled={savingId === row.id}
                          >
                            <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__clear__">— None —</SelectItem>
                              {descriptions.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  <span className="inline-flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                                    {d.name}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : desc ? (
                          <Badge variant="outline" style={{ borderColor: desc.color, color: desc.color }}>
                            {desc.name}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {fd.overridden ? (
                            <EduValidationBadge value={row.edu_validation} />
                          ) : (
                            <Badge variant="secondary" className="text-xs">{fd.label}</Badge>
                          )}
                          {fd.overridden && (
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="text-amber-600 text-xs">★</span>
                              </TooltipTrigger>
                              <TooltipContent>Overridden by Edu validation</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => { setAuditIssue({ id: row.id, case_id: row.case_id }); setAuditOpen(true); }}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <IssueAuditDialog
        open={auditOpen}
        onOpenChange={setAuditOpen}
        issueId={auditIssue?.id ?? null}
        caseId={auditIssue?.case_id ?? null}
      />
    </div>
  );
}
