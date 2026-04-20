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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWeeklyStudyPlans, type WeeklyPlan } from "@/hooks/useWeeklyStudyPlans";
import { useTutorProgress } from "@/hooks/useTutorProgress";
import { useUserRole } from "@/hooks/useUserRole";
import { StudyPlanDetailDialog } from "@/components/study-plan/StudyPlanDetailDialog";
import { SheetSyncCard } from "@/components/study-plan/SheetSyncCard";
import { LeavesSyncCard } from "@/components/study-plan/LeavesSyncCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportStudyPlanToExcel } from "@/utils/exportStudyPlanToExcel";

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
  const { data: progress = [], isLoading: progressLoading } = useTutorProgress(weekStart);
  const [progressFilter, setProgressFilter] = useState("");
  const [tlFilter, setTlFilter] = useState<string>("all");

  const teamLeaders = useMemo(() => {
    const set = new Set(plans.map((p) => p.team_leader).filter(Boolean));
    return Array.from(set).sort();
  }, [plans]);

  const filteredPlans = useMemo(
    () => (tlFilter === "all" ? plans : plans.filter((p) => p.team_leader === tlFilter)),
    [plans, tlFilter],
  );

  const stats = useMemo(() => {
    const tutors = filteredPlans.length;
    const totalFree = filteredPlans.reduce((s, p) => s + p.free_hours, 0);
    const totalPlanned = filteredPlans.reduce((s, p) => s + p.planned_hours, 0);
    const utilization =
      totalFree > 0 ? Math.round((totalPlanned / totalFree) * 100) : 0;
    return { tutors, totalFree, totalPlanned, utilization };
  }, [filteredPlans]);

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
                <LeavesSyncCard />
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

        <Tabs defaultValue="plans">
          <TabsList>
            <TabsTrigger value="plans">Weekly Plans</TabsTrigger>
            <TabsTrigger value="progress">Tutor Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="plans">
            <Card>
              <CardHeader>
                <CardTitle>Plans for week of {weekStart}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Team Leader</label>
                    <Select value={tlFilter} onValueChange={setTlFilter}>
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="All team leaders" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All team leaders</SelectItem>
                        {teamLeaders.map((tl) => (
                          <SelectItem key={tl} value={tl}>
                            {tl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportStudyPlanToExcel(filteredPlans, weekStart)}
                      disabled={filteredPlans.length === 0}
                    >
                      <Download className="h-4 w-4" />
                      Export to Excel
                    </Button>
                  </div>
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredPlans.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">
                    {plans.length === 0 ? (
                      <>No plans for this week yet. Click <b>Generate Plan</b> after data is loaded.</>
                    ) : (
                      <>No plans match the selected team leader.</>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tutor</TableHead>
                        <TableHead>Team Leader</TableHead>
                        <TableHead>Free h</TableHead>
                        <TableHead>Planned h</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead className="min-w-[280px]">Modules &amp; required completion</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPlans.map((p) => (
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
                            <div className="flex flex-wrap gap-1 max-w-md">
                              {(p.items ?? []).length === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                (p.items ?? []).map((it) => {
                                  const required = it.module?.hours_required ?? 0;
                                  const pct = required > 0
                                    ? Math.round((it.planned_hours / required) * 100)
                                    : 0;
                                  return (
                                    <Badge
                                      key={it.id}
                                      variant={it.is_partial ? "outline" : "secondary"}
                                      className="text-xs"
                                      title={`${it.planned_hours}h of ${required}h required`}
                                    >
                                      {it.module?.grade_band ?? "?"} · {it.module?.module_code ?? "?"} — {pct}%
                                    </Badge>
                                  );
                                })
                              )}
                            </div>
                          </TableCell>
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
          </TabsContent>

          <TabsContent value="progress">
            <Card>
              <CardHeader>
                <CardTitle>Tutor module progress — week of {weekStart}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Filter by tutor name, ID or team leader…"
                  value={progressFilter}
                  onChange={(e) => setProgressFilter(e.target.value)}
                  className="max-w-md"
                />
                {progressLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : progress.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">
                    No tutors synced for this week yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tutor</TableHead>
                        <TableHead>Team Leader</TableHead>
                        <TableHead className="text-center">Finished (from sheet)</TableHead>
                        <TableHead className="text-center">Remaining to study</TableHead>
                        <TableHead>Remaining modules (to study)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {progress
                        .filter((r) => {
                          const q = progressFilter.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            r.tutor_name.toLowerCase().includes(q) ||
                            r.tutor_external_id.toLowerCase().includes(q) ||
                            r.team_leader.toLowerCase().includes(q)
                          );
                        })
                        .map((r) => (
                          <TableRow key={r.tutor_external_id}>
                            <TableCell className="font-medium">
                              {r.tutor_name}
                              <div className="text-xs text-muted-foreground">
                                {r.tutor_external_id}
                              </div>
                            </TableCell>
                            <TableCell>{r.team_leader}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">
                                {r.finished_count} / {r.total_modules}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {r.remaining_count === 0 ? (
                                <Badge className="bg-primary hover:bg-primary text-primary-foreground">Done</Badge>
                              ) : (
                                <Badge variant="outline">{r.remaining_count}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 max-w-xl">
                                {r.remaining_modules.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">
                                    All modules completed
                                  </span>
                                ) : (
                                  r.remaining_modules.map((m, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {m.grade_band} · {m.module_code}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
