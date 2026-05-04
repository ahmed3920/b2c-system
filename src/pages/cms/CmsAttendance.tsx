import { useEffect, useMemo, useState } from "react";
import { CmsLayout } from "@/components/cms/CmsLayout";
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
import {
  Loader2,
  RefreshCw,
  CalendarCheck,
  Clock,
  AlertTriangle,
  UserX,
  Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCmsRole } from "@/hooks/useCmsRole";
import { cairoDateStr } from "@/hooks/useTodayAttendance";
import { useToast } from "@/hooks/use-toast";
import { CmsCheckinCard } from "@/components/cms/CmsCheckinCard";
import {
  CmsAdminEditAttendanceDialog,
  type CmsEditableRow,
} from "@/components/cms/CmsAdminEditAttendanceDialog";

type Status = "on_time" | "late" | "absent";

interface Row {
  id: string;
  user_id: string;
  user_name: string | null;
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

export default function CmsAttendancePage() {
  const { isCmsAdmin, isCmsSupervisor, loading: roleLoading } = useCmsRole();
  const seeAll = isCmsAdmin || isCmsSupervisor;
  const { toast } = useToast();

  const today = cairoDateStr();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState<CmsEditableRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    let query = supabase
      .from("cms_attendance")
      .select("*")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
      .order("user_name", { ascending: true });
    if (!seeAll && session?.user?.id) {
      query = query.eq("user_id", session.user.id);
    }
    const { data, error } = await query;
    if (error)
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    setRows(((data ?? []) as Row[]));
    setLoading(false);
  };

  useEffect(() => {
    if (!roleLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, roleLoading, seeAll]);

  const userOptions = useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => {
      const name = r.user_name || r.user_id;
      set.set(r.user_id, name);
    });
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (statusFilter === "all" || r.status === statusFilter) &&
          (userFilter === "all" || r.user_id === userFilter),
      ),
    [rows, statusFilter, userFilter],
  );

  const todayRows = rows.filter((r) => r.date === today);
  const totalUsers = useMemo(() => new Set(rows.map((r) => r.user_id)).size, [rows]);
  const checkedInToday = todayRows.filter((r) => r.status !== "absent").length;
  const lateToday = todayRows.filter((r) => r.status === "late").length;
  const absentToday = todayRows.filter((r) => r.status === "absent").length;

  const monthlyReport = useMemo(() => {
    const map = new Map<
      string,
      { name: string; total: number; on_time: number; late: number; absent: number }
    >();
    rows.forEach((r) => {
      const name = r.user_name || r.user_id;
      const cur = map.get(r.user_id) ?? {
        name,
        total: 0,
        on_time: 0,
        late: 0,
        absent: 0,
      };
      cur.total += 1;
      cur[r.status] += 1;
      map.set(r.user_id, cur);
    });
    return Array.from(map.values())
      .map((m) => ({
        ...m,
        on_time_pct: m.total > 0 ? Math.round((m.on_time / m.total) * 100) : 0,
      }))
      .sort((a, b) => b.on_time_pct - a.on_time_pct);
  }, [rows]);

  return (
    <CmsLayout title="Attendance">
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        {/* Check-in card always visible at top */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <CmsCheckinCard />
          </div>
          {seeAll && (
            <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard
                icon={<CalendarCheck className="h-4 w-4" />}
                label="CMS Users"
                value={totalUsers}
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
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent
            className={`p-4 grid grid-cols-1 ${seeAll ? "md:grid-cols-5" : "md:grid-cols-4"} gap-3`}
          >
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
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="on_time">On Time</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {seeAll && (
              <div>
                <Label className="text-xs">User</Label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {userOptions.map(([id, name]) => (
                      <SelectItem key={id} value={id}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={load} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="log">
          <TabsList>
            <TabsTrigger value="log">Daily Log</TabsTrigger>
            {seeAll && <TabsTrigger value="monthly">Monthly Report</TabsTrigger>}
          </TabsList>

          <TabsContent value="log" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Records ({filtered.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Check-in Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Min Late</TableHead>
                        <TableHead>Reason</TableHead>
                        {isCmsAdmin && (
                          <TableHead className="text-right">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell
                            colSpan={isCmsAdmin ? 7 : 6}
                            className="text-center py-8"
                          >
                            <Loader2 className="h-5 w-5 animate-spin inline-block text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={isCmsAdmin ? 7 : 6}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No records in this range.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">
                              {r.user_name || r.user_id.slice(0, 8)}
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
                            {isCmsAdmin && (
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditRow(r as CmsEditableRow);
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

          {seeAll && (
            <TabsContent value="monthly" className="mt-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Per User · {from} → {to}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
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
          )}
        </Tabs>
      </div>

      <CmsAdminEditAttendanceDialog
        row={editRow}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={load}
      />
    </CmsLayout>
  );
}
