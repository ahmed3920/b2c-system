import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CalendarCheck, Clock, AlertTriangle, UserX, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { cairoDateStr } from "@/hooks/useTodayAttendance";
import { useToast } from "@/hooks/use-toast";
import { AdminEditAttendanceDialog, type EditableRow } from "@/components/attendance/AdminEditAttendanceDialog";

type Status = "on_time" | "late" | "absent";

interface Row {
  id: string;
  team_leader_id: string;
  team_leader_name: string | null;
  date: string;
  check_in_time: string | null;
  status: Status;
  minutes_late: number;
  late_reason: string | null;
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "on_time")
    return (
      <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20">
        On Time
      </Badge>
    );
  if (status === "late")
    return (
      <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 hover:bg-red-500/20">
        Late
      </Badge>
    );
  return (
    <Badge variant="secondary" className="bg-muted text-muted-foreground">
      Absent
    </Badge>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: "green" | "red" | "gray" | "default";
}) {
  const toneClass =
    tone === "green"
      ? "text-green-600 dark:text-green-400"
      : tone === "red"
        ? "text-red-600 dark:text-red-400"
        : tone === "gray"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Cairo",
  });
}

export default function AttendancePage() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const today = cairoDateStr();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [tlFilter, setTlFilter] = useState<string>("all");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [editRow, setEditRow] = useState<EditableRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    let query = supabase
      .from("team_leader_attendance")
      .select("*")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
      .order("team_leader_name", { ascending: true });
    // Non-admins only see their own attendance, even if RLS would allow more.
    if (!isAdmin && session?.user?.id) {
      query = query.eq("team_leader_id", session.user.id);
    }
    const { data, error } = await query;
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    setRows(((data ?? []) as Row[]));
    setLoading(false);
  };

  useEffect(() => {
    if (!roleLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, roleLoading]);

  const tlOptions = useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => {
      const name = r.team_leader_name || r.team_leader_id;
      set.set(r.team_leader_id, name);
    });
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (statusFilter === "all" || r.status === statusFilter) &&
          (tlFilter === "all" || r.team_leader_id === tlFilter),
      ),
    [rows, statusFilter, tlFilter],
  );

  // Today summary (across full result, regardless of filters)
  const todayRows = rows.filter((r) => r.date === today);
  const totalTLs = useMemo(() => new Set(rows.map((r) => r.team_leader_id)).size, [rows]);
  const checkedInToday = todayRows.filter((r) => r.status !== "absent").length;
  const lateToday = todayRows.filter((r) => r.status === "late").length;
  const absentToday = todayRows.filter((r) => r.status === "absent").length;

  // Monthly report aggregation per team leader
  const monthlyReport = useMemo(() => {
    const map = new Map<
      string,
      { name: string; total: number; on_time: number; late: number; absent: number }
    >();
    rows.forEach((r) => {
      const name = r.team_leader_name || r.team_leader_id;
      const cur = map.get(r.team_leader_id) ?? {
        name,
        total: 0,
        on_time: 0,
        late: 0,
        absent: 0,
      };
      cur.total += 1;
      cur[r.status] += 1;
      map.set(r.team_leader_id, cur);
    });
    return Array.from(map.values())
      .map((m) => ({
        ...m,
        on_time_pct: m.total > 0 ? Math.round((m.on_time / m.total) * 100) : 0,
      }))
      .sort((a, b) => b.on_time_pct - a.on_time_pct);
  }, [rows]);

  const runAutoAbsent = async () => {
    setMarking(true);
    const { data, error } = await supabase.rpc("mark_absent_team_leaders" as never);
    setMarking(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Auto-absent run", description: `${data ?? 0} record(s) created` });
    load();
  };

  return (
    <AppLayout title="Attendance Tracking" allowedRoles={["admin", "team_leader", "super_team_leader"]}>
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        {/* Daily summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            icon={<CalendarCheck className="h-4 w-4" />}
            label="Team Leaders"
            value={totalTLs}
          />
          <SummaryCard
            icon={<Clock className="h-4 w-4" />}
            label="Checked In Today"
            value={checkedInToday}
            tone="green"
          />
          <SummaryCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Late Today"
            value={lateToday}
            tone="red"
          />
          <SummaryCard
            icon={<UserX className="h-4 w-4" />}
            label="Absent Today"
            value={absentToday}
            tone="gray"
          />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label htmlFor="from" className="text-xs">From</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                max={to}
              />
            </div>
            <div>
              <Label htmlFor="to" className="text-xs">To</Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                min={from}
                max={today}
              />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="on_time">On Time</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Team Leader</Label>
              <Select value={tlFilter} onValueChange={setTlFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {tlOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={load} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
              {isAdmin && (
                <Button variant="secondary" onClick={runAutoAbsent} disabled={marking}>
                  {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run Auto-Absent"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="log">
          <TabsList>
            <TabsTrigger value="log">Daily Log</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Report</TabsTrigger>
          </TabsList>

          <TabsContent value="log" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Records ({filtered.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team Leader</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Check-in Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Min Late</TableHead>
                        <TableHead>Reason</TableHead>
                        {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin inline-block text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">
                            No records in this range.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">
                              {r.team_leader_name || r.team_leader_id.slice(0, 8)}
                            </TableCell>
                            <TableCell>{r.date}</TableCell>
                            <TableCell>{formatTime(r.check_in_time)}</TableCell>
                            <TableCell><StatusBadge status={r.status} /></TableCell>
                            <TableCell className="text-right">
                              {r.status === "late" ? r.minutes_late : "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs max-w-[260px] truncate">
                              {r.late_reason || "—"}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditRow(r as EditableRow);
                                    setEditOpen(true);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Per Team Leader · {from} → {to}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team Leader</TableHead>
                        <TableHead className="text-right">Working Days</TableHead>
                        <TableHead className="text-right">On Time</TableHead>
                        <TableHead className="text-right">Late</TableHead>
                        <TableHead className="text-right">Absent</TableHead>
                        <TableHead className="text-right">On-Time %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyReport.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No data for selected range.
                          </TableCell>
                        </TableRow>
                      ) : (
                        monthlyReport.map((m) => (
                          <TableRow key={m.name}>
                            <TableCell className="font-medium">{m.name}</TableCell>
                            <TableCell className="text-right">{m.total}</TableCell>
                            <TableCell className="text-right text-green-600 dark:text-green-400">
                              {m.on_time}
                            </TableCell>
                            <TableCell className="text-right text-red-600 dark:text-red-400">
                              {m.late}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {m.absent}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {m.on_time_pct}%
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AdminEditAttendanceDialog
        row={editRow}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={load}
      />
    </AppLayout>
  );
}
