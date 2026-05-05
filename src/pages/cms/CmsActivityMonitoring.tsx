import { useMemo, useState } from "react";
import { CmsLayout } from "@/components/cms/CmsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Activity } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useCmsPermissions } from "@/hooks/useCmsPermissions";
import { useCmsActivitySummary, type UserActivitySummary } from "@/hooks/useCmsActivitySummary";

function formatHM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function statusBadge(status: UserActivitySummary["current_status"]) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" /> Active
        </Badge>
      );
    case "idle":
      return (
        <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-yellow-500" /> Idle
        </Badge>
      );
    case "inactive":
      return (
        <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" /> Inactive
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="bg-muted text-muted-foreground">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-muted-foreground" /> Offline
        </Badge>
      );
  }
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Cairo",
  });
}

export default function CmsActivityMonitoring() {
  const { can, loading: permLoading } = useCmsPermissions();
  const { rows, loading } = useCmsActivitySummary();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.current_status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (r.full_name ?? "").toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  const totals = useMemo(() => {
    const counts = { active: 0, idle: 0, inactive: 0, offline: 0 };
    rows.forEach((r) => {
      counts[r.current_status as keyof typeof counts] += 1;
    });
    return counts;
  }, [rows]);

  if (permLoading) {
    return (
      <CmsLayout title="Activity Monitoring">
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </CmsLayout>
    );
  }

  if (!can("view_all_activity")) {
    return <Navigate to="/cms" replace />;
  }

  return (
    <CmsLayout title="Activity Monitoring">
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">Active</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{totals.active}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-yellow-600">Idle</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{totals.idle}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">Inactive</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{totals.inactive}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Offline</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{totals.offline}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Today's Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="idle">Idle</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading && rows.length === 0 ? (
              <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">User</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-right px-3 py-2">Active</th>
                      <th className="text-right px-3 py-2">Idle</th>
                      <th className="text-right px-3 py-2">Inactive</th>
                      <th className="text-left px-3 py-2">Check-in</th>
                      <th className="text-left px-3 py-2">Check-out</th>
                      <th className="text-right px-3 py-2">Working</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.user_id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium text-foreground">{r.full_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.email ?? ""}</div>
                        </td>
                        <td className="px-3 py-2">{statusBadge(r.current_status)}</td>
                        <td className="px-3 py-2 text-right">{formatHM(r.active_minutes)}</td>
                        <td className="px-3 py-2 text-right">{formatHM(r.idle_minutes)}</td>
                        <td className="px-3 py-2 text-right">{formatHM(r.inactive_minutes)}</td>
                        <td className="px-3 py-2">{fmtTime(r.check_in_time)}</td>
                        <td className="px-3 py-2">{fmtTime(r.check_out_time)}</td>
                        <td className="px-3 py-2 text-right">{r.working_minutes != null ? formatHM(r.working_minutes) : "—"}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No users match your filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Auto-refreshes every 30 seconds. Status is inferred from the most recent activity heartbeat.</p>
          </CardContent>
        </Card>
      </div>
    </CmsLayout>
  );
}
