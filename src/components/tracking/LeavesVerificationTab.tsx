import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentTeamLeader } from "@/hooks/useCurrentTeamLeader";

type LeaveRow = {
  id: string;
  tutor_external_id: string;
  tutor_name: string | null;
  team_leader: string | null;
  is_mentor: boolean | null;
  leave_reason: string | null;
  leave_rule_id: string | null;
  leave_date: string;
  effective_days: number | null;
  is_request: boolean | null;
  source: string | null;
};

// Group reasons into a small set of buckets for the balance table
function bucketReason(reason: string | null | undefined, isRequest: boolean): string {
  if (isRequest) return "Request";
  const r = (reason ?? "").toLowerCase().trim();
  if (!r) return "Other";
  if (r.includes("excuse")) return "Excuse";
  if (r.includes("sick")) return "Sick";
  if (r.includes("annual")) return "Annual";
  if (r.includes("unpaid")) return "Unpaid";
  if (r.includes("emergency")) return "Emergency";
  if (r.includes("maternity") || r.includes("paternity")) return "Maternity/Paternity";
  if (r.includes("bereavement")) return "Bereavement";
  if (r.includes("compensation") || r.includes("comp ")) return "Compensation";
  return reason ?? "Other";
}

const REQUEST_REASONS_HINT = ["Add slot", "Remove slot", "Resign", "Termination"];

export function LeavesVerificationTab() {
  const { isAdmin } = useUserRole();
  const { teamLeader: myTeamLeader } = useCurrentTeamLeader();
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tutor_leaves")
        .select("*")
        .order("leave_date", { ascending: false })
        .limit(5000);
      if (!cancelled) {
        if (error) {
          console.error("Failed to load leaves", error);
          setRows([]);
        } else {
          setRows((data ?? []) as LeaveRow[]);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (reasonFilter !== "all") {
        const b = bucketReason(r.leave_reason, !!r.is_request);
        if (reasonFilter === "requests" && !r.is_request) return false;
        if (reasonFilter !== "requests" && b !== reasonFilter) return false;
      }
      if (!q) return true;
      return (
        (r.tutor_name ?? "").toLowerCase().includes(q) ||
        (r.tutor_external_id ?? "").toLowerCase().includes(q) ||
        (r.team_leader ?? "").toLowerCase().includes(q) ||
        (r.leave_reason ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, reasonFilter]);

  // Compute per-tutor balance (sum effective_days per bucket; for excuses also count occurrences)
  const balance = useMemo(() => {
    type TutorAgg = {
      tutor_external_id: string;
      tutor_name: string;
      team_leader: string;
      is_mentor: boolean;
      buckets: Record<string, number>;
      excuseCount: number;
      requestCount: number;
      total: number;
    };
    const map = new Map<string, TutorAgg>();
    for (const r of rows) {
      const key = r.tutor_external_id;
      let agg = map.get(key);
      if (!agg) {
        agg = {
          tutor_external_id: r.tutor_external_id,
          tutor_name: r.tutor_name ?? r.tutor_external_id,
          team_leader: r.team_leader ?? "—",
          is_mentor: !!r.is_mentor,
          buckets: {},
          excuseCount: 0,
          requestCount: 0,
          total: 0,
        };
        map.set(key, agg);
      }
      const bucket = bucketReason(r.leave_reason, !!r.is_request);
      const days = Number(r.effective_days ?? 0);
      agg.buckets[bucket] = (agg.buckets[bucket] ?? 0) + days;
      if (r.is_request) agg.requestCount += 1;
      else if (bucket === "Excuse") {
        agg.excuseCount += 1;
        agg.total += days;
      } else {
        agg.total += days;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const balanceColumns = useMemo(() => {
    const set = new Set<string>();
    for (const t of balance) for (const k of Object.keys(t.buckets)) set.add(k);
    // stable order
    const preferred = [
      "Sick",
      "Annual",
      "Unpaid",
      "Emergency",
      "Compensation",
      "Maternity/Paternity",
      "Bereavement",
      "Excuse",
      "Request",
      "Other",
    ];
    const ordered = preferred.filter((p) => set.has(p));
    for (const k of set) if (!ordered.includes(k)) ordered.push(k);
    return ordered;
  }, [balance]);

  const filteredBalance = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return balance;
    return balance.filter(
      (t) =>
        t.tutor_name.toLowerCase().includes(q) ||
        t.tutor_external_id.toLowerCase().includes(q) ||
        t.team_leader.toLowerCase().includes(q),
    );
  }, [balance, search]);

  const reasonOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.is_request) continue;
      set.add(bucketReason(r.leave_reason, false));
    }
    return Array.from(set).sort();
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Search by tutor, T ID, team leader…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8"
          />
        </div>
        {!isAdmin && myTeamLeader && (
          <Badge variant="outline" className="text-xs">
            Showing your team only
          </Badge>
        )}
        <Badge variant="secondary" className="text-xs">
          {rows.length} records
        </Badge>
      </div>

      <Tabs defaultValue="balance">
        <TabsList>
          <TabsTrigger value="balance">Tutors Balance</TabsTrigger>
          <TabsTrigger value="records">Leaves Records</TabsTrigger>
        </TabsList>

        <TabsContent value="balance" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" /> Tutors Balance
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Effective days used per leave type. <strong>Excuse</strong> shows
                count of excuses (each = 0.2 day). <strong>Request</strong>{" "}
                tallies non-leave actions: {REQUEST_REASONS_HINT.join(", ")}.
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : filteredBalance.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  No leave records yet. Sync the Leaves sheet from the Study
                  Plan admin page to populate this view.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tutor</TableHead>
                        <TableHead>T ID</TableHead>
                        <TableHead>Team Leader</TableHead>
                        <TableHead className="text-center">Role</TableHead>
                        {balanceColumns.map((c) => (
                          <TableHead key={c} className="text-right">
                            {c === "Excuse" ? "Excuses (#)" : `${c} (days)`}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Total days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBalance.map((t) => (
                        <TableRow key={t.tutor_external_id}>
                          <TableCell className="font-medium">
                            {t.tutor_name}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.tutor_external_id}
                          </TableCell>
                          <TableCell>{t.team_leader}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={t.is_mentor ? "default" : "outline"}
                              className="text-[10px]"
                            >
                              {t.is_mentor ? "Mentor" : "Tutor"}
                            </Badge>
                          </TableCell>
                          {balanceColumns.map((c) => {
                            const days = t.buckets[c] ?? 0;
                            const display =
                              c === "Excuse"
                                ? t.excuseCount
                                : c === "Request"
                                  ? t.requestCount
                                  : days
                                    ? days.toFixed(days % 1 === 0 ? 0 : 1)
                                    : "—";
                            return (
                              <TableCell
                                key={c}
                                className="text-right tabular-nums"
                              >
                                {display}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right font-semibold tabular-nums">
                            {t.total ? t.total.toFixed(1) : "0"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="mt-3">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">Leaves Records</CardTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge
                  variant={reasonFilter === "all" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setReasonFilter("all")}
                >
                  All
                </Badge>
                {reasonOptions.map((r) => (
                  <Badge
                    key={r}
                    variant={reasonFilter === r ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setReasonFilter(r)}
                  >
                    {r}
                  </Badge>
                ))}
                <Badge
                  variant={reasonFilter === "requests" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setReasonFilter("requests")}
                >
                  Requests
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  No records match the current filters.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Tutor</TableHead>
                        <TableHead>T ID</TableHead>
                        <TableHead>Team Leader</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-center">Type</TableHead>
                        <TableHead className="text-right">Effective</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">
                            {r.leave_date}
                          </TableCell>
                          <TableCell className="font-medium">
                            {r.tutor_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.tutor_external_id}
                          </TableCell>
                          <TableCell>{r.team_leader ?? "—"}</TableCell>
                          <TableCell>{r.leave_reason ?? "—"}</TableCell>
                          <TableCell className="text-center">
                            {r.is_request ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
                                Request
                              </Badge>
                            ) : r.is_mentor ? (
                              <Badge variant="outline" className="text-[10px]">
                                Mentor
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                Tutor
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {Number(r.effective_days ?? 0).toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
