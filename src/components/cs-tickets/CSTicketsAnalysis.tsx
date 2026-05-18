import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, AlertTriangle, FileWarning } from "lucide-react";
import { useCSTickets } from "./useCSTickets";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentTeamLeader } from "@/hooks/useCurrentTeamLeader";
import { CreateActionPlanDialog } from "@/components/action-plans/CreateActionPlanDialog";
import { supabase } from "@/integrations/supabase/client";
import type { ActionPlan } from "@/hooks/useActionPlans";

const VALID_STATUSES = new Set(["Valid", "Validated"]);

export function CSTicketsAnalysis() {
  const { tickets, loading } = useCSTickets("all");
  const { isAdmin } = useUserRole();
  const { teamLeader } = useCurrentTeamLeader();
  const [search, setSearch] = useState("");
  const [plansByTutor, setPlansByTutor] = useState<Map<string, ActionPlan>>(new Map());
  const [refreshTick, setRefreshTick] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [preselectTutor, setPreselectTutor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("action_plans")
        .select("*")
        .eq("category", "cs_complaints")
        .in("status", ["active", "on_hold", "escalated"])
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const map = new Map<string, ActionPlan>();
      for (const p of (data ?? []) as ActionPlan[]) {
        if (p.tutor_external_id && !map.has(p.tutor_external_id)) map.set(p.tutor_external_id, p);
      }
      setPlansByTutor(map);
    })();
    return () => { cancelled = true; };
  }, [refreshTick]);

  const rows = useMemo(() => {
    const map = new Map<string, {
      tutor_external_id: string;
      tutor_name: string;
      team_leader: string;
      valid: number;
      total: number;
      pending: number;
      notValid: number;
      lastDate: string | null;
    }>();
    for (const t of tickets) {
      const key = t.tutor_external_id || t.tutor_name;
      if (!key) continue;
      const isValid = VALID_STATUSES.has(t.status);
      const existing = map.get(key) ?? {
        tutor_external_id: t.tutor_external_id,
        tutor_name: t.tutor_name,
        team_leader: t.team_leader,
        valid: 0, total: 0, pending: 0, notValid: 0,
        lastDate: null as string | null,
      };
      existing.total += 1;
      if (isValid) existing.valid += 1;
      if (t.status === "Pending") existing.pending += 1;
      if (t.status === "Not Valid" || t.status === "Rejected") existing.notValid += 1;
      if (!existing.lastDate || t.ticket_date > existing.lastDate) existing.lastDate = t.ticket_date;
      map.set(key, existing);
    }
    return Array.from(map.values())
      .filter((r) => r.valid > 0) // only tutors with valid tickets
      .sort((a, b) => b.valid - a.valid || b.total - a.total);
  }, [tickets]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      [r.tutor_name, r.tutor_external_id, r.team_leader].some((v) => (v || "").toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const totals = useMemo(() => ({
    tutors: rows.length,
    validTickets: rows.reduce((s, r) => s + r.valid, 0),
    repeaters: rows.filter((r) => r.valid >= 2).length,
  }), [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Tutors with Valid CS Tickets" value={totals.tutors} icon={<FileWarning className="h-4 w-4" />} />
        <StatCard label="Total Valid CS Tickets" value={totals.validTickets} icon={<FileWarning className="h-4 w-4" />} />
        <StatCard label="Repeaters (≥ 2 valid)" value={totals.repeaters} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} highlight />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle>CS Tickets Analysis</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Valid CS ticket counts per tutor. Tutors with 2+ valid tickets are flagged as repeaters and need an action plan.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tutor..." className="pl-8 w-[240px]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Team Leader</TableHead>
                  <TableHead className="text-right">Valid</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Not Valid</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Last Ticket</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="h-20 text-center">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="h-20 text-center text-muted-foreground">No tutors with valid CS tickets.</TableCell></TableRow>
                ) : filtered.map((r) => {
                  const isRepeater = r.valid >= 2;
                  const hasPlan = plansByTutor.has(r.tutor_external_id);
                  return (
                    <TableRow key={r.tutor_external_id || r.tutor_name} className={isRepeater ? "bg-destructive/5" : ""}>
                      <TableCell>
                        <div className="font-medium">{r.tutor_name}</div>
                        <div className="text-xs text-muted-foreground">{r.tutor_external_id}</div>
                      </TableCell>
                      <TableCell className="text-sm">{r.team_leader}</TableCell>
                      <TableCell className="text-right font-semibold">{r.valid}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.pending}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.notValid}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.total}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.lastDate ?? "—"}</TableCell>
                      <TableCell>
                        {isRepeater ? (
                          <Badge variant="destructive">Repeater</Badge>
                        ) : (
                          <Badge variant="outline">Single</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isRepeater && (
                          hasPlan ? (
                            <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20">Plan active</Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => { setPreselectTutor(r.tutor_external_id); setCreateOpen(true); }}
                            >
                              Create Action Plan
                            </Button>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateActionPlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => { setRefreshTick((t) => t + 1); setCreateOpen(false); }}
        isAdmin={isAdmin}
        currentTeamLeader={teamLeader}
        preselectTutorExternalId={preselectTutor}
        preselectCategory="cs_complaints"
        lockCategory
      />
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-destructive/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
