import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWeeklyStudyPlans, type WeeklyPlan } from "@/hooks/useWeeklyStudyPlans";
import { useUserRole } from "@/hooks/useUserRole";
import { StudyPlanDetailDialog } from "@/components/study-plan/StudyPlanDetailDialog";
import { SheetSyncCard } from "@/components/study-plan/SheetSyncCard";

// Week starts on Friday for this organisation
function fridayOf(d: Date): string {
  const day = d.getDay(); // 0=Sun
  // offset to reach the most-recent Friday (or today if already Fri)
  const diff = day >= 5 ? day - 5 : day + 2; // Fri=0, Sat=1, Sun=2, Mon=3…
  const f = new Date(d);
  f.setDate(d.getDate() - diff);
  return f.toISOString().slice(0, 10);
}

export default function StudyPlan() {
  const { isAdmin } = useUserRole();
  const [weekStart, setWeekStart] = useState<string>(fridayOf(new Date()));
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<WeeklyPlan | null>(null);

  const { data: plans = [], isLoading, refetch } = useWeeklyStudyPlans(weekStart);

  const stats = useMemo(() => {
    const tutors = plans.length;
    const totalFree = plans.reduce((s, p) => s + p.free_hours, 0);
    const totalPlanned = plans.reduce((s, p) => s + p.planned_hours, 0);
    const utilization =
      totalFree > 0 ? Math.round((totalPlanned / totalFree) * 100) : 0;
    return { tutors, totalFree, totalPlanned, utilization };
  }, [plans]);

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-weekly-plan",
        { body: { week_start: weekStart } },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        `Generated ${(data as any).plans_created} plans · ${(data as any).items_created} module assignments`,
      );
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate plan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout title="Weekly Study Plan" allowedRoles={["admin", "team_leader"]}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Generate plan for week</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Week start (Fri)</label>
              <Input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-44"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tutors work Fri→Tue or Sat→Wed — pick the Friday of the working week.
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={busy || !weekStart}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate Plan
            </Button>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Google Sheets sources (admin)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <SheetSyncCard
                  kind="upcoming_sessions"
                  title="Upcoming sessions"
                  description="Pre-week: scheduled sessions per tutor for the selected week."
                  weekStart={weekStart}
                />
                <SheetSyncCard
                  kind="pre_modules"
                  title="Published modules — before week"
                  description="Pre-week: assigned/finished modules per tutor."
                  weekStart={weekStart}
                />
                <SheetSyncCard
                  kind="ended_sessions"
                  title="Ended-week sessions"
                  description="Post-week: actual sessions delivered (incl. covers)."
                  weekStart={weekStart}
                />
                <SheetSyncCard
                  kind="post_modules"
                  title="Published modules — after week"
                  description="Post-week: which modules each tutor finished."
                  weekStart={weekStart}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard label="Tutors" value={stats.tutors} />
          <StatCard label="Total free hours" value={stats.totalFree} />
          <StatCard label="Total planned hours" value={stats.totalPlanned} />
          <StatCard label="Utilization" value={`${stats.utilization}%`} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Plans for week of {weekStart}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : plans.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                No plans for this week yet. Click <b>Generate Plan</b> after data is loaded.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tutor</TableHead>
                    <TableHead>Team Leader</TableHead>
                    <TableHead>Free h</TableHead>
                    <TableHead>Planned h</TableHead>
                    <TableHead>Modules</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(p)}
                    >
                      <TableCell className="font-medium">
                        {p.tutor_name}
                        <div className="text-xs text-muted-foreground">
                          {p.tutor_external_id}
                        </div>
                      </TableCell>
                      <TableCell>{p.team_leader}</TableCell>
                      <TableCell>{p.free_hours}</TableCell>
                      <TableCell>{p.planned_hours}</TableCell>
                      <TableCell>{p.items?.length ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <StudyPlanDetailDialog plan={selected} onClose={() => setSelected(null)} />
      </div>
    </AppLayout>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
