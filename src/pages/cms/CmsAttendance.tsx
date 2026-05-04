import { useEffect, useMemo, useState } from "react";
import { CmsLayout } from "@/components/cms/CmsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CmsCheckinCard } from "@/components/cms/CmsCheckinCard";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCmsRole } from "@/hooks/useCmsRole";

interface Row {
  id: string;
  user_id: string;
  user_name: string | null;
  date: string;
  check_in_time: string | null;
  status: "on_time" | "late" | "absent";
  minutes_late: number;
  late_reason: string | null;
}

export default function CmsAttendance() {
  const { isCmsAdmin, isCmsSupervisor } = useCmsRole();
  const seeAll = isCmsAdmin || isCmsSupervisor;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const monthStart = new Date();
      monthStart.setDate(1);
      const ym = monthStart.toISOString().slice(0, 10);
      let q = supabase
        .from("cms_attendance")
        .select("*")
        .gte("date", ym)
        .order("date", { ascending: false });
      if (!seeAll && session) q = q.eq("user_id", session.user.id);
      const { data } = await q;
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, [seeAll]);

  const stats = useMemo(() => {
    const onTime = rows.filter((r) => r.status === "on_time").length;
    const late = rows.filter((r) => r.status === "late").length;
    const absent = rows.filter((r) => r.status === "absent").length;
    const total = rows.length || 1;
    return { onTime, late, absent, pct: Math.round((onTime / total) * 100) };
  }, [rows]);

  return (
    <CmsLayout title="Attendance">
      <div className="p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1"><CmsCheckinCard /></div>
          <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">On time (mo.)</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{stats.onTime}</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Late (mo.)</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{stats.late}</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Absent (mo.)</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{stats.absent}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>{seeAll ? "Team attendance — this month" : "My attendance — this month"}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {seeAll && <TableHead>User</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Late (min)</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={seeAll ? 6 : 5}>Loading…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={seeAll ? 6 : 5} className="text-center text-muted-foreground">No records</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.date}</TableCell>
                    {seeAll && <TableCell>{r.user_name ?? "—"}</TableCell>}
                    <TableCell>
                      <Badge variant={r.status === "on_time" ? "default" : r.status === "late" ? "secondary" : "destructive"}>
                        {r.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : "—"}</TableCell>
                    <TableCell>{r.minutes_late || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.late_reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </CmsLayout>
  );
}
