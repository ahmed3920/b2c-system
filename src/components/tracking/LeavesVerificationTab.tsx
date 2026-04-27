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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Search,
  Calendar as CalendarIcon,
  AlertTriangle,
  TrendingUp,
  Users,
  Lightbulb,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentTeamLeader } from "@/hooks/useCurrentTeamLeader";
import { LeavesSyncCard } from "@/components/study-plan/LeavesSyncCard";

type LeaveRow = {
  id: string;
  tutor_external_id: string;
  tutor_name: string | null;
  team_leader: string | null;
  is_mentor: boolean | null;
  leave_reason: string | null;
  leave_rule_id: string | null;
  leave_date: string;
  leave_end_date: string | null;
  effective_days: number | null;
  is_request: boolean | null;
  source: string | null;
};

function formatDateShort(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function daysBetween(startISO: string, endISO: string): number {
  const s = new Date(startISO + "T00:00:00Z").getTime();
  const e = new Date(endISO + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

function bucketReason(reason: string | null | undefined, isRequest: boolean): string {
  if (isRequest) return "Request";
  const r = (reason ?? "").toLowerCase().trim();
  if (!r) return "Other";
  if (r.includes("excuse")) return "Excuse";
  if (r.includes("sick")) return "Sick";
  if (r.includes("emergency")) return "Emergency";
  if (r.includes("death") || r.includes("bereavement")) return "Death";
  if (r.includes("marriage")) return "Marriage";
  if (r.includes("maternity")) return "Maternity";
  if (r.includes("paternity")) return "Paternity";
  if (r.includes("unpaid")) return "Unpaid Vacation";
  if (r.includes("special")) return "Special Request";
  if (r.includes("vacation") || r.includes("annual")) return "Vacation";
  return reason ?? "Other";
}

const REQUEST_REASONS_HINT = ["Add slot", "Remove slot", "Resign", "Termination"];

const ALL_BUCKETS = [
  "Sick",
  "Vacation",
  "Unpaid Vacation",
  "Emergency",
  "Marriage",
  "Maternity",
  "Paternity",
  "Death",
  "Special Request",
  "Excuse",
  "Request",
  "Other",
];

/* ---------- Policy month helpers (26 → 25) ---------- */
// For an iso date, return policy month label like "April 2026" where the
// month is determined by the period 26 of (M-1) → 25 of M.
function policyMonthOf(iso: string): { key: string; label: string } {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDate();
  let m = d.getUTCMonth(); // 0-11
  let y = d.getUTCFullYear();
  if (day >= 26) {
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  const key = `${y}-${String(m + 1).padStart(2, "0")}`;
  const label = new Date(Date.UTC(y, m, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { key, label };
}

function currentPolicyMonthKey(): string {
  const now = new Date();
  const iso = now.toISOString().slice(0, 10);
  return policyMonthOf(iso).key;
}

function policyMonthRange(key: string): { start: string; end: string } {
  // key = YYYY-MM → range: 26 of previous month → 25 of this month
  const [yStr, mStr] = key.split("-");
  const y = Number(yStr);
  const m = Number(mStr) - 1; // 0-11
  const start = new Date(Date.UTC(y, m - 1, 26));
  const end = new Date(Date.UTC(y, m, 25));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/* ---------- Emergency policy (from Action Plans) ---------- */
// Per emergency policy, more than 1 emergency in the same policy month is
// considered abusive (warning email territory and beyond).
const EMERGENCY_ABUSE_THRESHOLD = 2; // count >= 2 in a policy month → highlight

export function LeavesVerificationTab() {
  const { isAdmin } = useUserRole();
  const { teamLeader: myTeamLeader } = useCurrentTeamLeader();
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Multi-select: empty Set = "all". A special "__requests__" entry means
  // "include request rows". Otherwise entries are bucket names.
  const [reasonFilter, setReasonFilter] = useState<Set<string>>(new Set());
  const [tlFilter, setTlFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all"); // all | tutor | mentor
  const [monthFilter, setMonthFilter] = useState<string>("all"); // policy month key

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tutor_leaves")
        .select("*")
        .order("leave_date", { ascending: false })
        .limit(10000);
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

  const teamLeaderOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.team_leader) set.add(r.team_leader);
    return Array.from(set).sort();
  }, [rows]);

  const monthOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const { key, label } = policyMonthOf(r.leave_date);
      if (!map.has(key)) map.set(key, label);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, label]) => ({ key, label }));
  }, [rows]);

  // Apply global filters (used by Records, Balance & Analysis tabs)
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tlFilter !== "all" && r.team_leader !== tlFilter) return false;
      if (roleFilter === "mentor" && !r.is_mentor) return false;
      if (roleFilter === "tutor" && r.is_mentor) return false;
      if (monthFilter !== "all") {
        if (policyMonthOf(r.leave_date).key !== monthFilter) return false;
      }
      if (reasonFilter.size > 0) {
        const b = bucketReason(r.leave_reason, !!r.is_request);
        if (r.is_request) {
          if (!reasonFilter.has("__requests__")) return false;
        } else {
          if (!reasonFilter.has(b)) return false;
        }
      }
      if (!q) return true;
      return (
        (r.tutor_name ?? "").toLowerCase().includes(q) ||
        (r.tutor_external_id ?? "").toLowerCase().includes(q) ||
        (r.team_leader ?? "").toLowerCase().includes(q) ||
        (r.leave_reason ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, tlFilter, roleFilter, monthFilter, reasonFilter]);

  /* ---------- Tutors balance (uses filteredRows) ---------- */
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
    for (const r of filteredRows) {
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
  }, [filteredRows]);

  const balanceColumns = useMemo(() => {
    const set = new Set<string>();
    for (const t of balance) for (const k of Object.keys(t.buckets)) set.add(k);
    const ordered = ALL_BUCKETS.filter((p) => set.has(p));
    for (const k of set) if (!ordered.includes(k)) ordered.push(k);
    return ordered;
  }, [balance]);

  const reasonOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.is_request) continue;
      set.add(bucketReason(r.leave_reason, false));
    }
    return Array.from(set).sort();
  }, [rows]);

  /* ---------- Analysis: per Team Leader breakdown ---------- */
  const tlBreakdown = useMemo(() => {
    type TLAgg = {
      team_leader: string;
      buckets: Record<string, number>; // sum of effective days per bucket
      counts: Record<string, number>; // count of records per bucket
      tutorIds: Set<string>;
      totalDays: number;
      totalRecords: number;
    };
    const map = new Map<string, TLAgg>();
    for (const r of filteredRows) {
      const tl = r.team_leader ?? "—";
      let agg = map.get(tl);
      if (!agg) {
        agg = {
          team_leader: tl,
          buckets: {},
          counts: {},
          tutorIds: new Set(),
          totalDays: 0,
          totalRecords: 0,
        };
        map.set(tl, agg);
      }
      const bucket = bucketReason(r.leave_reason, !!r.is_request);
      const days = Number(r.effective_days ?? 0);
      agg.buckets[bucket] = (agg.buckets[bucket] ?? 0) + days;
      agg.counts[bucket] = (agg.counts[bucket] ?? 0) + 1;
      agg.tutorIds.add(r.tutor_external_id);
      agg.totalDays += days;
      agg.totalRecords += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.totalDays - a.totalDays);
  }, [filteredRows]);

  const tlBreakdownColumns = useMemo(() => {
    const set = new Set<string>();
    for (const t of tlBreakdown)
      for (const k of Object.keys(t.buckets)) set.add(k);
    const ordered = ALL_BUCKETS.filter((p) => set.has(p));
    for (const k of set) if (!ordered.includes(k)) ordered.push(k);
    return ordered;
  }, [tlBreakdown]);

  /* ---------- Top requesters ---------- */
  const topRequesters = useMemo(() => {
    return balance.slice(0, 10);
  }, [balance]);

  const topExcusers = useMemo(() => {
    return [...balance]
      .filter((t) => t.excuseCount > 0)
      .sort((a, b) => b.excuseCount - a.excuseCount)
      .slice(0, 10);
  }, [balance]);

  /* ---------- Emergency abuse detection (per policy month) ---------- */
  type EmergencyAbuse = {
    tutor_external_id: string;
    tutor_name: string;
    team_leader: string;
    monthKey: string;
    monthLabel: string;
    count: number;
    dates: string[];
  };
  const emergencyAbuse = useMemo<EmergencyAbuse[]>(() => {
    // Always evaluate over rows (ignoring monthFilter) so admins see all months,
    // but respect TL/role/search/team filters.
    const base = rows.filter((r) => {
      if (tlFilter !== "all" && r.team_leader !== tlFilter) return false;
      if (roleFilter === "mentor" && !r.is_mentor) return false;
      if (roleFilter === "tutor" && r.is_mentor) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (r.tutor_name ?? "").toLowerCase().includes(q) ||
        (r.tutor_external_id ?? "").toLowerCase().includes(q) ||
        (r.team_leader ?? "").toLowerCase().includes(q)
      );
    });
    const grouped = new Map<string, EmergencyAbuse>();
    for (const r of base) {
      if (r.is_request) continue;
      if (bucketReason(r.leave_reason, false) !== "Emergency") continue;
      const { key, label } = policyMonthOf(r.leave_date);
      if (monthFilter !== "all" && key !== monthFilter) continue;
      const gkey = `${r.tutor_external_id}::${key}`;
      let g = grouped.get(gkey);
      if (!g) {
        g = {
          tutor_external_id: r.tutor_external_id,
          tutor_name: r.tutor_name ?? r.tutor_external_id,
          team_leader: r.team_leader ?? "—",
          monthKey: key,
          monthLabel: label,
          count: 0,
          dates: [],
        };
        grouped.set(gkey, g);
      }
      g.count += 1;
      g.dates.push(r.leave_date);
    }
    return Array.from(grouped.values())
      .filter((g) => g.count >= EMERGENCY_ABUSE_THRESHOLD)
      .sort((a, b) =>
        b.count - a.count || (a.monthKey < b.monthKey ? 1 : -1),
      );
  }, [rows, tlFilter, roleFilter, search, monthFilter]);

  /* ---------- Auto insights ---------- */
  const insights = useMemo(() => {
    const list: { tone: "warn" | "info" | "good"; text: string }[] = [];

    // 1. Emergency abusers
    if (emergencyAbuse.length > 0) {
      list.push({
        tone: "warn",
        text: `${emergencyAbuse.length} tutor-month case${
          emergencyAbuse.length > 1 ? "s" : ""
        } exceed the 1-emergency-per-month policy. Consider warning emails or escalation per the Emergency Policy.`,
      });
    }

    // 2. Excuse abuse: > 5 excuses (=1 day) in a single policy month
    const excuseHotspots = new Map<string, number>();
    for (const r of filteredRows) {
      if (r.is_request) continue;
      if (bucketReason(r.leave_reason, false) !== "Excuse") continue;
      const { key } = policyMonthOf(r.leave_date);
      const k = `${r.tutor_external_id}::${key}`;
      excuseHotspots.set(k, (excuseHotspots.get(k) ?? 0) + 1);
    }
    const excuseAbusers = Array.from(excuseHotspots.values()).filter(
      (n) => n >= 5,
    ).length;
    if (excuseAbusers > 0) {
      list.push({
        tone: "warn",
        text: `${excuseAbusers} tutor-month case${
          excuseAbusers > 1 ? "s" : ""
        } accumulated 5+ excuses (≥ 1 effective day). Investigate punctuality/attendance patterns.`,
      });
    }

    // 3. Team leader carrying disproportionate load
    if (tlBreakdown.length > 1) {
      const totals = tlBreakdown.map((t) => t.totalDays);
      const sum = totals.reduce((a, b) => a + b, 0);
      const max = Math.max(...totals);
      if (sum > 0 && max / sum > 0.35) {
        const top = tlBreakdown[0];
        list.push({
          tone: "info",
          text: `Team "${top.team_leader}" accounts for ${(
            (max / sum) *
            100
          ).toFixed(0)}% of all leave days. Worth a focused conversation with the team leader.`,
        });
      }
    }

    // 4. Sick leave concentration
    let sickDays = 0;
    let totalDays = 0;
    for (const r of filteredRows) {
      if (r.is_request) continue;
      const days = Number(r.effective_days ?? 0);
      totalDays += days;
      if (bucketReason(r.leave_reason, false) === "Sick") sickDays += days;
    }
    if (totalDays > 0 && sickDays / totalDays > 0.4) {
      list.push({
        tone: "info",
        text: `Sick leaves represent ${((sickDays / totalDays) * 100).toFixed(
          0,
        )}% of total leave days — unusually high. Consider wellness checks or workload review.`,
      });
    }

    // 5. Healthy state
    if (list.length === 0) {
      list.push({
        tone: "good",
        text: "No abuse patterns detected in the current selection. Leaves usage looks within policy.",
      });
    }
    return list;
  }, [emergencyAbuse, filteredRows, tlBreakdown]);

  return (
    <div className="space-y-4">
      {isAdmin && <LeavesSyncCard />}

      {/* Filters bar */}
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

        <Select value={tlFilter} onValueChange={setTlFilter}>
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="Team Leader" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All team leaders</SelectItem>
            {teamLeaderOptions.map((tl) => (
              <SelectItem key={tl} value={tl}>
                {tl}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="tutor">Tutors only</SelectItem>
            <SelectItem value="mentor">Mentors only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="Policy month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            <SelectItem value={currentPolicyMonthKey()}>
              Current (26→25)
            </SelectItem>
            {monthOptions.map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={reasonFilter} onValueChange={setReasonFilter}>
          <SelectTrigger className="h-8 w-[160px]">
            <SelectValue placeholder="Reason" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reasons</SelectItem>
            {reasonOptions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
            <SelectItem value="requests">Requests only</SelectItem>
          </SelectContent>
        </Select>

        {!isAdmin && myTeamLeader && (
          <Badge variant="outline" className="text-xs">
            Showing your team only
          </Badge>
        )}
        <Badge variant="secondary" className="text-xs">
          {filteredRows.length} / {rows.length} records
        </Badge>
      </div>

      <Tabs defaultValue="balance">
        <TabsList>
          <TabsTrigger value="balance">Tutors Balance</TabsTrigger>
          <TabsTrigger value="records">Leaves Records</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        {/* ---------------- Balance tab ---------------- */}
        <TabsContent value="balance" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" /> Tutors Balance
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Effective days used per leave type. <strong>Excuse</strong>{" "}
                shows count of excuses (each = 0.2 day). <strong>Request</strong>{" "}
                tallies non-leave actions: {REQUEST_REASONS_HINT.join(", ")}.
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loading />
              ) : balance.length === 0 ? (
                <Empty />
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
                      {balance.map((t) => (
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

        {/* ---------------- Records tab ---------------- */}
        <TabsContent value="records" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Leaves Records</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loading />
              ) : filteredRows.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  No records match the current filters.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Date range</TableHead>
                        <TableHead>Tutor</TableHead>
                        <TableHead>T ID</TableHead>
                        <TableHead>Team Leader</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-center">Type</TableHead>
                        <TableHead className="text-right">Effective</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((r) => {
                        const end = r.leave_end_date ?? r.leave_date;
                        const sameDay = end === r.leave_date;
                        const span = daysBetween(r.leave_date, end);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {sameDay ? (
                                formatDateShort(r.leave_date)
                              ) : (
                                <>
                                  {formatDateShort(r.leave_date)} –{" "}
                                  {formatDateShort(end)}{" "}
                                  <span className="text-muted-foreground">
                                    ({span} day{span > 1 ? "s" : ""})
                                  </span>
                                </>
                              )}
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
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  Mentor
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  Tutor
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {Number(r.effective_days ?? 0).toFixed(1)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Analysis tab ---------------- */}
        <TabsContent value="analysis" className="mt-3 space-y-4">
          {/* Insights */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4" /> Insights & Suggested Actions
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Auto-generated recommendations based on the current filter
                selection.
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {insights.map((i, idx) => (
                  <li
                    key={idx}
                    className={
                      "text-sm rounded-md border px-3 py-2 " +
                      (i.tone === "warn"
                        ? "bg-destructive/5 border-destructive/30 text-primary"
                        : i.tone === "good"
                          ? "bg-emerald-500/5 border-emerald-500/30"
                          : "bg-muted/40")
                    }
                  >
                    {i.text}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Emergency abuse */}
          <Card className="border-destructive/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" /> Emergency Abuse
                (Policy: 26 → 25)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Per Emergency Policy: only 1 emergency per policy month is
                accepted without action. Tutors with{" "}
                <strong>{EMERGENCY_ABUSE_THRESHOLD} or more</strong>{" "}
                emergencies in the same month are flagged for warning email or
                escalation.
              </p>
            </CardHeader>
            <CardContent>
              {emergencyAbuse.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No emergency abuse cases detected for the current filters.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tutor</TableHead>
                        <TableHead>T ID</TableHead>
                        <TableHead>Team Leader</TableHead>
                        <TableHead>Policy month</TableHead>
                        <TableHead className="text-right">Emergencies</TableHead>
                        <TableHead>Suggested action</TableHead>
                        <TableHead>Dates</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emergencyAbuse.map((g) => {
                        const action =
                          g.count === 2
                            ? "Warning Email + 1x or 2x deduction"
                            : g.count === 3
                              ? "Warning Email + Meeting + 2x or 3x deduction"
                              : "HR Investigation / Action Plan";
                        return (
                          <TableRow
                            key={`${g.tutor_external_id}-${g.monthKey}`}
                            className="bg-destructive/5"
                          >
                            <TableCell className="font-medium">
                              {g.tutor_name}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {g.tutor_external_id}
                            </TableCell>
                            <TableCell>{g.team_leader}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {g.monthLabel}
                              <div className="text-[10px] text-muted-foreground">
                                {(() => {
                                  const r = policyMonthRange(g.monthKey);
                                  return `${formatDateShort(r.start)} – ${formatDateShort(r.end)}`;
                                })()}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              <Badge variant="destructive">{g.count}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{action}</TableCell>
                            <TableCell className="text-xs font-mono">
                              {g.dates
                                .sort()
                                .map((d) => formatDateShort(d))
                                .join(", ")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top requesters */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Top Requesters (by total
                  days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topRequesters.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Tutor</TableHead>
                          <TableHead>Team Leader</TableHead>
                          <TableHead className="text-right">
                            Total days
                          </TableHead>
                          <TableHead className="text-right">Excuses</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topRequesters.map((t, i) => (
                          <TableRow key={t.tutor_external_id}>
                            <TableCell className="text-muted-foreground">
                              {i + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {t.tutor_name}
                            </TableCell>
                            <TableCell>{t.team_leader}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">
                              {t.total.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {t.excuseCount}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Top Excuse Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topExcusers.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Tutor</TableHead>
                          <TableHead>Team Leader</TableHead>
                          <TableHead className="text-right">Excuses</TableHead>
                          <TableHead className="text-right">
                            Equiv. days
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topExcusers.map((t, i) => (
                          <TableRow key={t.tutor_external_id}>
                            <TableCell className="text-muted-foreground">
                              {i + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {t.tutor_name}
                            </TableCell>
                            <TableCell>{t.team_leader}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">
                              {t.excuseCount}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {(t.excuseCount * 0.2).toFixed(1)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Team Leader breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Per Team Leader Breakdown
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Sum of effective days per leave type, grouped by team leader.
                Excuses are counted in the Excuse column (each = 0.2 day).
              </p>
            </CardHeader>
            <CardContent>
              {tlBreakdown.length === 0 ? (
                <Empty />
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team Leader</TableHead>
                        <TableHead className="text-right">Tutors</TableHead>
                        <TableHead className="text-right">Records</TableHead>
                        {tlBreakdownColumns.map((c) => (
                          <TableHead key={c} className="text-right">
                            {c === "Excuse" ? "Excuses (#)" : `${c} (days)`}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Total days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tlBreakdown.map((t) => (
                        <TableRow key={t.team_leader}>
                          <TableCell className="font-medium">
                            {t.team_leader}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {t.tutorIds.size}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {t.totalRecords}
                          </TableCell>
                          {tlBreakdownColumns.map((c) => {
                            const days = t.buckets[c] ?? 0;
                            const count = t.counts[c] ?? 0;
                            const display =
                              c === "Excuse"
                                ? count
                                : c === "Request"
                                  ? count
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
                            {t.totalDays ? t.totalDays.toFixed(1) : "0"}
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

function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  );
}

function Empty() {
  return (
    <div className="text-sm text-muted-foreground py-8 text-center">
      No data to display for the current filters.
    </div>
  );
}
